// Pure multi-floor routing graph + Dijkstra (no React / DOM imports).
//
// Every floor is its own planar graph built from that floor's path GeoJSON.
// Floors are joined by "stairs" edges (matched between consecutive floors by
// position), and building entrances use entrance-stairs or ramp edges so a
// step-free (PWD) route can avoid stairs.

import { haversine, lineLength, projectOnLine, projectOnSegment, boundsCenter, polygonCentroid, pointInPolygon, toXY, toLngLat } from './geo.js';
import {
  FLOORS,
  WALKING_SPEED_MPS,
  RAMP_SPEED_MPS,
  STAIRS_SECONDS_PER_FLOOR,
  STAIRS_LENGTH_M,
} from '../constants.js';

// --- Tunables ---
const NODE_TOL_M = 0.8; // endpoints closer than this are the same node
const SNAP_TOL_M = 3; // dead ends within this of another line are joined (T-junction)
const STAIR_ATTACH_MAX_M = 16; // stair centre -> nearest corridor
const STAIR_MATCH_MAX_M = 8; // stair on floor n <-> stair on floor n+1
const ROOM_ATTACH_MAX_M = 60; // room centroid -> nearest corridor
const ONEWAY_PENALTY_M = 3; // ranking penalty for snapping onto one-way lines

// Drawings flag nearly every path one-way (digitising direction). Only real one-way traffic is kept:
// vehicle exit roads, the ring leading to the Gate 2 exit, and the Gate 1 -> lobby entrance walkway.
const isOneWayName = (name) => /^Exit road|\(to Gate 2\)|^Entrance walkway/i.test(name || '');

// --- Line collection ---

function isRampName(name) {
  return /^(PWD|PCED) ramp/i.test(name || '');
}

function macroLines(macroPaths) {
  return (macroPaths?.features || []).map((f) => ({
    id: f.properties.id,
    name: f.properties.name,
    kind: 'walk',
    zone: 'outdoor',
    oneway: isOneWayName(f.properties.name),
    coords: f.geometry.coordinates.map((c) => [c[0], c[1]]),
    // Older data named its junctions; newer data has none (gates/entrances are found by geometry)
    tags: f.properties.from ? { start: `node:${f.properties.from}`, end: `node:${f.properties.to}` } : undefined,
  }));
}

function floorLines(floor, paths) {
  return (paths?.features || []).map((f, i) => {
    const p = f.properties;
    const name = p.name || `Floor ${floor} path`;
    const ramp = isRampName(name);
    return {
      id: p.id || `f${floor}_path_${i}`,
      name,
      kind: ramp ? 'ramp' : 'walk',
      zone: floor === 1 && !/corridor/i.test(name) && !ramp ? 'outdoor' : 'indoor',
      oneway: floor === 1 && isOneWayName(name),
      building: p.building || null,
      spur: /(Access|Entrance) — /.test(name),
      coords: f.geometry.coordinates.map((c) => [c[0], c[1]]),
      // Connector tops (first vertex) bridge the plaza gap to the ramps / corridor
      snapTol: /^Connector/i.test(name) ? 10 : /(Access|Entrance) — /.test(name) ? 10 : undefined, // corner-room spurs can stop ~9 m short of the corridor
      snapFilter: /^Connector/i.test(name) ? (t) => t.kind === 'ramp' || /corridor/i.test(t.name) : undefined,
      snapStartOnly: /^Connector/i.test(name),
    };
  });
}

// Entrance stairs / ramps are drawn as a straight line from low end to high end.
// The line is slid sideways so its low end meets the closest approaching path.
function riseLine(struct, kind, name, candidates) {
  const [minX, minY, maxX, maxY] = struct.bounds;
  const [cx, cy] = boundsCenter(struct.bounds);
  const d = struct.direction;
  const vertical = d === 'north' || d === 'south'; // rises along latitude
  const lowAtMin = d === 'north' || d === 'east';
  const edge = vertical
    ? [[minX, lowAtMin ? minY : maxY], [maxX, lowAtMin ? minY : maxY]]
    : [[lowAtMin ? minX : maxX, minY], [lowAtMin ? minX : maxX, maxY]];

  let best = null;
  for (const l of candidates) {
    if (l.kind === 'door') continue;
    for (const v of l.coords) {
      const r = projectOnLine(v, edge);
      const score = r.distance + (l.oneway ? ONEWAY_PENALTY_M : 0);
      if (r.distance <= 8 && (!best || score < best.score)) best = { score, point: r.point };
    }
  }
  const along = best ? (vertical ? best.point[0] : best.point[1]) : vertical ? cx : cy;
  const [a, b] = vertical
    ? [[along, lowAtMin ? minY : maxY], [along, lowAtMin ? maxY : minY]]
    : [[lowAtMin ? minX : maxX, along], [lowAtMin ? maxX : minX, along]];
  return {
    id: struct.id,
    name,
    kind,
    zone: 'entrance',
    oneway: false,
    building: struct.building,
    coords: [a, b],
    snapTol: 8,
  };
}

// Proper interior crossing of segments a1-a2 and b1-b2 (ends excluded: those are handled as T-junctions)
function crossing(a1, a2, b1, b2) {
  const p = toXY(a1);
  const r = toXY(a2).map((v, i) => v - p[i]);
  const q = toXY(b1);
  const s = toXY(b2).map((v, i) => v - q[i]);
  const den = r[0] * s[1] - r[1] * s[0];
  if (Math.abs(den) < 1e-9) return null;
  const t = ((q[0] - p[0]) * s[1] - (q[1] - p[1]) * s[0]) / den;
  const u = ((q[0] - p[0]) * r[1] - (q[1] - p[1]) * r[0]) / den;
  const e = 0.02;
  if (t <= e || t >= 1 - e || u <= e || u >= 1 - e) return null;
  return { t, u, point: toLngLat([p[0] + t * r[0], p[1] + t * r[1]]) };
}

// --- Planarize: split lines at junctions and merge endpoints into nodes ---

function planarize(lines) {
  const items = lines.map((l) => ({
    ...l,
    verts: l.coords.map((c) => ({ c, node: false, tag: null })),
  }));
  items.forEach((l) => {
    l.verts[0].node = true;
    l.verts[l.verts.length - 1].node = true;
    if (l.tags?.start) l.verts[0].tag = l.tags.start;
    if (l.tags?.end) l.verts[l.verts.length - 1].tag = l.tags.end;
    if (l.startTag) l.verts[0].tag = l.startTag;
  });

  // Pass 1: decide how each dead end connects (computed on the untouched geometry)
  const inserts = [];
  const extensions = [];

  // Paths that cross mid-segment are one junction (revised drawings may not share a vertex there)
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const A = items[i];
      const B = items[j];
      if (A.kind === 'door' || B.kind === 'door') continue;
      for (let k = 0; k < A.coords.length - 1; k++) {
        for (let m = 0; m < B.coords.length - 1; m++) {
          const hit = crossing(A.coords[k], A.coords[k + 1], B.coords[m], B.coords[m + 1]);
          if (!hit) continue;
          inserts.push({ B: A, ref: A.verts[k], t: hit.t, vert: { c: hit.point, node: true, tag: null } });
          inserts.push({ B, ref: B.verts[m], t: hit.u, vert: { c: hit.point, node: true, tag: null } });
        }
      }
    }
  }
  for (const A of items) {
    for (const atStart of [true, false]) {
      const e = atStart ? A.verts[0] : A.verts[A.verts.length - 1];
      const special = !A.snapStartOnly || atStart;
      const tol = special ? A.snapTol ?? SNAP_TOL_M : SNAP_TOL_M;
      const filter = special ? A.snapFilter : undefined;
      let best = null;
      for (const B of items) {
        if (B === A || B.kind === 'door' || (filter && !filter(B))) continue;
        const r = projectOnLine(e.c, B.coords);
        // One-way roads are a last resort so walkways don't latch onto vehicle exits
        const score = r ? r.distance + (B.oneway ? ONEWAY_PENALTY_M : 0) : Infinity;
        if (r && r.distance <= tol && (!best || score < best.score)) best = { B, r, score };
      }
      if (!best) continue;
      const { B, r } = best;
      const ref = B.verts.find((v) => v.c === B.coords[r.segmentIndex]);
      const refNext = B.verts.find((v) => v.c === B.coords[r.segmentIndex + 1]);
      const snapped = [ref, refNext].find((v) => v && haversine(v.c, r.point) <= NODE_TOL_M);
      let target;
      if (snapped) {
        snapped.node = true;
        target = snapped;
      } else {
        target = { c: r.point, node: true, tag: null };
        inserts.push({ B, ref, t: r.t, vert: target });
      }
      if (haversine(e.c, target.c) > NODE_TOL_M) extensions.push({ A, atStart, vert: target });
    }
  }

  // Pass 2: apply T-junction insertions, then dead-end extensions
  const byLine = new Map();
  inserts.forEach((i) => byLine.set(i.B, [...(byLine.get(i.B) || []), i]));
  byLine.forEach((list, B) => {
    list.sort((x, y) => y.t - x.t);
    list.forEach(({ ref, vert }) => B.verts.splice(B.verts.indexOf(ref) + 1, 0, vert));
  });
  extensions.forEach(({ A, atStart, vert }) => {
    const copy = { ...vert, tag: null };
    if (atStart) A.verts.unshift(copy);
    else A.verts.push(copy);
  });

  // Cluster node vertices (spatial union-find; named nodes such as GATE_1 are unified)
  const nodeVerts = items.flatMap((l) => l.verts.filter((v) => v.node));
  const parent = nodeVerts.map((_, i) => i);
  const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const union = (i, j) => {
    parent[find(i)] = find(j);
  };
  const cell = (v) => `${Math.round(v.c[0] / 0.00001)}:${Math.round(v.c[1] / 0.00001)}`;
  const grid = new Map();
  nodeVerts.forEach((v, i) => {
    const [cx, cy] = cell(v).split(':').map(Number);
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++)
        (grid.get(`${cx + dx}:${cy + dy}`) || []).forEach((j) => {
          if (haversine(nodeVerts[j].c, v.c) <= NODE_TOL_M) union(i, j);
        });
    const k = cell(v);
    grid.set(k, [...(grid.get(k) || []), i]);
  });
  const named = new Map();
  nodeVerts.forEach((v, i) => {
    if (v.tag && v.tag.startsWith('node:')) {
      if (named.has(v.tag)) union(i, named.get(v.tag));
      else named.set(v.tag, i);
    }
  });

  const clusterIds = new Map();
  const nodes = [];
  nodeVerts.forEach((v, i) => {
    const root = find(i);
    if (!clusterIds.has(root)) {
      clusterIds.set(root, nodes.length);
      nodes.push({ coord: v.c });
    }
    v.nodeIdx = clusterIds.get(root);
  });

  const tagNode = new Map();
  nodeVerts.forEach((v) => {
    if (v.tag && !tagNode.has(v.tag)) tagNode.set(v.tag, v.nodeIdx);
  });

  // Split every line at its node vertices into edges
  const edges = [];
  for (const l of items) {
    let start = 0;
    for (let i = 1; i < l.verts.length; i++) {
      if (!l.verts[i].node) continue;
      const a = l.verts[start];
      const b = l.verts[i];
      const coords = l.verts.slice(start, i + 1).map((v) => v.c);
      const len = lineLength(coords);
      if (a.nodeIdx !== b.nodeIdx || len > 0.5) {
        edges.push({
          lineId: l.id,
          name: l.name,
          kind: l.kind,
          zone: l.zone,
          oneway: l.oneway,
          building: l.building || null,
          spur: !!l.spur,
          stairName: l.stairName,
          a: a.nodeIdx,
          b: b.nodeIdx,
          coords,
          len,
        });
      }
      start = i;
    }
  }
  return { nodes, edges, tagNode };
}

// Revised data repeats the ground network in both macro and floor-1 files; keep one copy of each line
// (duplicates would otherwise snap onto each other instead of joining the rest of the network).
function dedupeLines(lines) {
  const same = (a, b) =>
    a.coords.length === b.coords.length &&
    (a.coords.every((c, i) => haversine(c, b.coords[i]) < 0.5) ||
      a.coords.every((c, i) => haversine(c, b.coords[b.coords.length - 1 - i]) < 0.5));
  const out = [];
  lines.forEach((l) => {
    if (!out.some((k) => same(k, l))) out.push(l);
  });
  return out;
}

// --- Building the full graph ---

function nearestOnLines(point, lines, filter) {
  let best = null;
  for (const l of lines) {
    if (filter && !filter(l)) continue;
    const r = projectOnLine(point, l.coords);
    const score = r ? r.distance + (l.oneway ? ONEWAY_PENALTY_M : 0) : Infinity;
    if (r && (!best || score < best.score)) best = { ...r, score };
  }
  return best;
}

function roomsOf(floorData) {
  return floorData?.rooms?.features || [];
}

// raw = { macroPaths, floors: { [n]: { rooms, paths, structures } } }
export function buildGraph(raw) {
  const nodes = [];
  const edges = [];
  const tags = new Map(); // tag -> global node id
  const roomIds = assignRoomIds(raw); // room feature -> id

  const addPlanar = (floor, lines) => {
    const { nodes: ns, edges: es, tagNode } = planarize(lines);
    const base = nodes.length;
    ns.forEach((n) => nodes.push({ id: nodes.length, floor, coord: n.coord }));
    es.forEach((e) => edges.push({ ...e, id: edges.length, floor, a: e.a + base, b: e.b + base }));
    tagNode.forEach((idx, tag) => {
      if (!tags.has(tag)) tags.set(tag, idx + base);
    });
  };

  for (const floor of FLOORS) {
    const fd = raw.floors?.[floor];
    if (!fd?.paths && floor !== 1) continue;

    const base = dedupeLines([...floorLines(floor, fd?.paths), ...(floor === 1 ? macroLines(raw.macroPaths) : [])]);
    const extra = [];
    const structs = fd?.structures || [];

    // Entrance stairs / ramps (floor 1 only)
    if (floor === 1) {
      structs.forEach((s) => {
        if (s.type === 'stairs' && s.layout === 'single') {
          extra.push(riseLine(s, 'entrance-stairs', s.full_name || s.name, base));
        } else if (s.type === 'ramp') {
          const c = boundsCenter(s.bounds);
          const covered = nearestOnLines(c, base, (l) => l.kind === 'ramp');
          if (!covered || covered.distance > 6) extra.push(riseLine(s, 'ramp', s.label || s.name, base));
        }
      });
    }

    // Stair landings: stair centre -> nearest corridor, tagged for the vertical links
    structs.forEach((s) => {
      if (!/^stairs/.test(s.type) || s.layout === 'single') return;
      const c = boundsCenter(s.bounds);
      const hit = nearestOnLines(c, [...base, ...extra], (l) => l.kind !== 'entrance-stairs');
      if (!hit || hit.distance > STAIR_ATTACH_MAX_M) return;
      extra.push({
        id: `landing_${s.id}`,
        name: s.name,
        stairName: s.name,
        kind: 'landing',
        zone: 'indoor',
        oneway: false,
        building: s.building,
        coords: [c, hit.point],
        startTag: `stair:${floor}:${s.id}`,
        snapTol: 0.5,
      });
    });

    // Room doors: room centroid -> nearest corridor (prefer the same building)
    roomsOf(fd).forEach((f) => {
      const c = polygonCentroid(f.geometry);
      const same = base.filter((l) => l.building && l.building === f.properties.building);
      const pool = same.length ? same : base.filter((l) => l.zone !== 'outdoor' || floor === 1);
      const hit = nearestOnLines(c, [...pool, ...extra.filter((l) => l.kind === 'ramp')]);
      if (!hit || hit.distance > ROOM_ATTACH_MAX_M) return;
      const id = roomIds.get(f);
      extra.push({
        id: `door_${id}`,
        name: f.properties.name || f.properties.code,
        kind: 'door',
        zone: 'indoor',
        oneway: false,
        building: f.properties.building,
        coords: [c, hit.point],
        startTag: `room:${id}`,
        snapTol: 0.5,
      });
    });

    addPlanar(floor, [...base, ...extra]);
  }

  // Vertical links: stairs on floor n <-> matching stairs on floor n+1
  for (const floor of FLOORS) {
    const lower = (raw.floors?.[floor]?.structures || []).filter(
      (s) => s.type === 'stairs' && s.layout !== 'single',
    );
    const upper = (raw.floors?.[floor + 1]?.structures || []).filter(
      (s) => /^stairs/.test(s.type) && s.layout !== 'single',
    );
    for (const s of lower) {
      const c = boundsCenter(s.bounds);
      let best = null;
      for (const u of upper) {
        const d = haversine(c, boundsCenter(u.bounds));
        if (d <= STAIR_MATCH_MAX_M && (!best || d < best.d)) best = { u, d };
      }
      if (!best) continue;
      const a = tags.get(`stair:${floor}:${s.id}`);
      const b = tags.get(`stair:${floor + 1}:${best.u.id}`);
      if (a === undefined || b === undefined) continue;
      edges.push({
        id: edges.length,
        lineId: `stairs_${s.id}_${best.u.id}`,
        name: s.full_name || s.name,
        stairName: s.name,
        kind: 'stairs',
        zone: 'indoor',
        oneway: false,
        building: s.building || null,
        a,
        b,
        floor,
        floorTo: floor + 1,
        coords: [nodes[a].coord],
        coordsTo: [nodes[b].coord],
        len: STAIRS_LENGTH_M,
      });
    }
  }

  const adj = nodes.map(() => []);
  edges.forEach((e) => {
    adj[e.a].push({ edge: e, to: e.b, forward: true });
    if (!e.oneway) adj[e.b].push({ edge: e, to: e.a, forward: false });
  });

  return { nodes, edges, adj, tags, roomIds };
}

// Unique, stable room ids (code + floor, plus #n when a code repeats on a floor).
// Shared by the graph and the search index so ids always match.
export function assignRoomIds(raw) {
  const ids = new Map();
  const taken = new Set();
  for (const floor of FLOORS) {
    for (const f of roomsOf(raw.floors?.[floor])) {
      const base = `${f.properties.code || f.properties.name || 'room'}@F${floor}`;
      let id = base;
      for (let n = 2; taken.has(id); n++) id = `${base}#${n}`;
      taken.add(id);
      ids.set(f, id);
    }
  }
  return ids;
}

// --- Dijkstra ---

class MinHeap {
  constructor() {
    this.a = [];
  }
  get size() {
    return this.a.length;
  }
  push(item) {
    const a = this.a;
    a.push(item);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p][0] <= a[i][0]) break;
      [a[p], a[i]] = [a[i], a[p]];
      i = p;
    }
  }
  pop() {
    const a = this.a;
    const top = a[0];
    const last = a.pop();
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && a[l][0] < a[m][0]) m = l;
        if (r < a.length && a[r][0] < a[m][0]) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        i = m;
      }
    }
    return top;
  }
}

// Travel time (seconds) of one edge, or Infinity when the mode forbids it
export function edgeCost(edge, mode = {}) {
  const isStairs = edge.kind === 'stairs' || edge.kind === 'entrance-stairs';
  if (isStairs && mode.avoidStairs) return Infinity;
  if (edge.kind === 'stairs') return STAIRS_SECONDS_PER_FLOOR;
  if (edge.kind === 'entrance-stairs') return edge.len / WALKING_SPEED_MPS + 6;
  if (edge.kind === 'ramp') return edge.len / RAMP_SPEED_MPS;
  return edge.len / WALKING_SPEED_MPS;
}

// Shortest path from `sources` (node ids) to the cheapest of `targets`.
// Returns { nodeIds, steps: [{ edge, forward }], cost, target } or null.
export function shortestPath(graph, sources, targets, mode = {}) {
  const dist = new Map();
  const prev = new Map();
  const heap = new MinHeap();
  sources.forEach((s) => {
    dist.set(s, 0);
    heap.push([0, s]);
  });
  const targetSet = new Set(targets);
  let found = null;

  while (heap.size) {
    const [d, u] = heap.pop();
    if (d > (dist.get(u) ?? Infinity)) continue;
    if (targetSet.has(u)) {
      found = u;
      break;
    }
    for (const { edge, to, forward } of graph.adj[u]) {
      const w = edgeCost(edge, mode);
      if (w === Infinity) continue;
      const nd = d + w;
      if (nd < (dist.get(to) ?? Infinity)) {
        dist.set(to, nd);
        prev.set(to, { from: u, edge, forward });
        heap.push([nd, to]);
      }
    }
  }
  if (found === null) return null;

  const steps = [];
  const nodeIds = [found];
  for (let cur = found; prev.has(cur); ) {
    const p = prev.get(cur);
    steps.push({ edge: p.edge, forward: p.forward });
    nodeIds.push(p.from);
    cur = p.from;
  }
  steps.reverse();
  nodeIds.reverse();
  return { nodeIds, steps, cost: dist.get(found), target: found };
}


// --- Geometry lookups (gates, parking and building entrances have no named nodes in the data) ---

function distanceToPolygon(point, geometry) {
  if (pointInPolygon(point, geometry)) return 0;
  const rings = geometry.type === 'MultiPolygon' ? geometry.coordinates.map((c) => c[0]) : [geometry.coordinates[0]];
  let best = Infinity;
  for (const ring of rings) {
    for (let i = 0; i < ring.length - 1; i++) best = Math.min(best, projectOnSegment(point, ring[i], ring[i + 1]).distance);
  }
  return best;
}

// Ground-floor nodes at (or nearest to) a polygon. Several nodes are returned so one-way dead ends
// (an exit road ending at a gate) never trap the route: nodes within `slack` metres of the closest one.
export function nodesNearGeometry(graph, geometry, { floor = 1, slack = 6, max = 8 } = {}) {
  const scored = graph.nodes
    .filter((n) => n.floor === floor)
    .map((n) => ({ id: n.id, d: distanceToPolygon(n.coord, geometry) }))
    .sort((a, b) => a.d - b.d);
  if (!scored.length) return [];
  return scored.filter((n) => n.d <= scored[0].d + slack).slice(0, max).map((n) => n.id);
}
