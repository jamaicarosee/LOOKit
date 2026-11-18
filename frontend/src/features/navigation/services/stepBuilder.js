// Pure step generation: turns a shortest-path edge list into pieces, legs and
// natural-language steps (no React / DOM imports).

import { bearing, compassName, turnAngle, lineLength, haversine } from './geo.js';
import { WALKING_SPEED_MPS } from '../constants.js';
import { edgeCost } from './graph.js';

const STRAIGHT_DEG = 25;
const SLIGHT_DEG = 60;
const SHARP_DEG = 125;

// --- Helpers ---

const floorLabel = (n) => `Floor ${n}`;

// "Main Gateway Road (Gate 1 to M.A.E Junction)" -> "Main Gateway Road"
const cleanName = (n) => (n || '').replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s+/g, ' ').trim();

function turnWord(delta) {
  const side = delta > 0 ? 'right' : 'left';
  const a = Math.abs(delta);
  if (a >= 160) return { type: 'u-turn', text: 'Make a U-turn' };
  if (a >= SHARP_DEG) return { type: `sharp-${side}`, text: `Turn sharply ${side}` };
  if (a >= SLIGHT_DEG) return { type: side, text: `Turn ${side}` };
  return { type: `slight-${side}`, text: `Bear ${side}` };
}

// Orient an edge in its direction of travel
function orient(edge, forward) {
  const name = cleanName(edge.name);
  if (edge.kind === 'stairs') {
    return forward
      ? { ...edge, name, floorFrom: edge.floor, floorTo: edge.floorTo, coords: edge.coords, coordTo: edge.coordsTo[0] }
      : { ...edge, name, floorFrom: edge.floorTo, floorTo: edge.floor, coords: edge.coordsTo, coordTo: edge.coords[0] };
  }
  return {
    ...edge,
    name,
    up: forward, // ramps / entrance stairs are digitised low -> high
    floorFrom: edge.floor,
    floorTo: edge.floor,
    coords: forward ? edge.coords : [...edge.coords].reverse(),
  };
}

// Last / first usable heading of a polyline (skips zero-length segments)
function headingAt(coords, atEnd) {
  const idx = atEnd ? coords.map((_, i) => i).reverse() : coords.map((_, i) => i);
  for (const i of idx) {
    const a = atEnd ? coords[i - 1] : coords[i];
    const b = atEnd ? coords[i] : coords[i + 1];
    if (a && b && (a[0] !== b[0] || a[1] !== b[1])) return bearing(a, b);
  }
  return null;
}

// Named nodes (gates, lobby) unify points that sit a few metres apart; walk that gap explicitly
function stitch(list) {
  const out = [];
  list.forEach((p, i) => {
    const prev = list[i - 1];
    if (prev && prev.kind !== 'stairs' && p.kind !== 'stairs' && prev.floorFrom === p.floorFrom) {
      const a = prev.coords[prev.coords.length - 1];
      const b = p.coords[0];
      const gap = haversine(a, b);
      if (gap > 0.5 && gap <= 25) {
        out.push({ ...p, kind: p.kind === 'door' || p.kind === 'landing' ? 'walk' : p.kind, spur: !!p.spur, coords: [a, b], len: gap, cost: gap / WALKING_SPEED_MPS });
      }
    }
    out.push(p);
  });
  return out;
}

function mergeNeighbours(pieces) {
  const out = [];
  for (const p of pieces) {
    const last = out[out.length - 1];
    const mergeable =
      last &&
      (p.kind === 'walk' || p.kind === 'ramp' || p.kind === 'entrance-stairs') &&
      last.kind === p.kind &&
      last.floorFrom === p.floorFrom &&
      last.up === p.up &&
      last.name === p.name;
    if (mergeable) {
      last.coords = [...last.coords, ...p.coords.slice(1)];
      last.len += p.len;
      last.cost += p.cost;
    } else {
      out.push({ ...p });
    }
  }
  // Fuse a room's short access spur with its door so they read as one step
  const fused = [];
  for (const p of out) {
    const last = fused[fused.length - 1];
    const isEnd = (x) => x.kind === 'door' || x.kind === 'landing';
    if (last && ((last.spur && isEnd(p)) || (isEnd(last) && p.spur))) {
      const door = isEnd(last) ? last : p;
      last.coords = [...last.coords, ...p.coords.slice(1)];
      last.len += p.len;
      last.cost += p.cost;
      last.kind = door.kind;
      last.spur = false;
      last.name = door.name;
    } else {
      fused.push(p);
    }
  }
  return fused;
}

// --- Main entry ---

// path: { steps: [{ edge, forward }] } from shortestPath
// ctx: { fromLabel, toLabel, mode, buildingAt(coord), startFloor, endFloor, endKind, graph, nodeIds }
export function buildRouteResult(path, ctx) {
  const mode = ctx.mode || {};
  const raw = path.steps.map(({ edge, forward }) => ({
    ...orient(edge, forward),
    cost: edgeCost(edge, mode),
  }));
  const pieces = mergeNeighbours(stitch(raw));

  const steps = [];
  let seq = 0;
  const add = (s) => steps.push({ id: `step-${seq++}`, distanceMeters: 0, bearing: null, ...s });

  const startCoord = pieces[0]?.coords[0] || ctx.startCoord;
  add({
    type: 'start',
    instruction: `Start at ${ctx.fromLabel}`,
    floor: ctx.startFloor ?? pieces[0]?.floorFrom ?? 1,
    coordinate: startCoord,
    coords: [startCoord],
  });

  let heading = null; // null right after the start or after a floor change
  let lastZone = ctx.startZone || 'outdoor';
  let afterVertical = false;

  for (let i = 0; i < pieces.length; i++) {
    const p = pieces[i];
    const isLast = i === pieces.length - 1;

    // Vertical stairs (merge a chain of floors into one step)
    if (p.kind === 'stairs') {
      let to = p.floorTo;
      let j = i;
      while (pieces[j + 1]?.kind === 'stairs' && Math.sign(pieces[j + 1].floorTo - pieces[j + 1].floorFrom) === Math.sign(to - p.floorFrom)) {
        j++;
        to = pieces[j].floorTo;
      }
      const up = to > p.floorFrom;
      const n = Math.abs(to - p.floorFrom);
      add({
        type: up ? 'stairs-up' : 'stairs-down',
        instruction: `Take the stairs ${up ? 'up' : 'down'} ${n > 1 ? `${n} floors ` : ''}to ${floorLabel(to)}${p.stairName && n === 1 ? ` (${p.stairName})` : ''}`,
        floor: p.floorFrom,
        floorTo: to,
        coordinate: p.coords[0],
        coords: [p.coords[0]],
        coordTo: pieces[j].coordTo,
        edgeName: p.name,
      });
      i = j;
      heading = null;
      afterVertical = true;
      lastZone = 'indoor';
      continue;
    }

    const dist = Math.round(lineLength(p.coords));
    const h0 = headingAt(p.coords, false);
    const h1 = headingAt(p.coords, true);
    const inner = p.up === false ? p.coords[0] : p.coords[p.coords.length - 1];
    const building = p.building || ctx.buildingAt?.(inner) || ctx.buildingAt?.(p.coords[Math.floor(p.coords.length / 2)]) || 'the building';

    // Entrance stairs and ramps
    if (p.kind === 'entrance-stairs' || p.kind === 'ramp') {
      const ramp = p.kind === 'ramp';
      // In / out is decided by which end is inside a building footprint (drawn direction is unreliable)
      const a = ctx.insideBuilding?.(p.coords[0]);
      const z = ctx.insideBuilding?.(p.coords[p.coords.length - 1]);
      const dir = !a && z ? 'in' : a && !z ? 'out' : null;
      if (dir === null && dist < 3) {
        heading = h1; // a sliver of ramp/stairs between two paths: no step needed
        continue;
      }
      add({
        type: ramp ? 'ramp' : dir === 'out' ? 'stairs-down' : 'stairs-up',
        instruction: ramp
          ? dir === 'in' ? `Take the PWD ramp up into ${building}` : dir === 'out' ? `Take the PWD ramp down and out of ${building}` : 'Take the PWD ramp'
          : dir === 'in' ? `Climb the entrance stairs into ${building}` : dir === 'out' ? `Go down the entrance stairs out of ${building}` : 'Take the entrance stairs',
        distanceMeters: dist,
        bearing: h0,
        floor: p.floorFrom,
        coordinate: p.coords[0],
        coords: p.coords,
        edgeName: p.name,
      });
      heading = h1;
      lastZone = dir === 'out' ? 'outdoor' : dir === 'in' ? 'indoor' : lastZone;
      afterVertical = false;
      continue;
    }

    // Walking pieces (corridors, outdoor paths, the last metres to a room door)
    if (lastZone === 'outdoor' && p.zone === 'indoor') {
      add({
        type: 'enter',
        instruction: `Enter ${building}`,
        floor: p.floorFrom,
        coordinate: p.coords[0],
        coords: [p.coords[0]],
      });
      lastZone = 'indoor';
    }
    if (p.zone !== 'entrance') lastZone = p.zone;

    const isDoor = p.kind === 'door';
    const isLanding = p.kind === 'landing';
    const isFirst = steps.length === 1;
    let lead;
    let type = 'straight';

    if (heading === null || h0 === null) {
      const dir = h0 === null ? '' : ` ${compassName(h0)}`;
      lead = afterVertical ? `Leave the stairs and head${dir}` : isDoor && isFirst ? `Leave ${p.name} and head${dir}` : `Head${dir}`;
      type = 'start-walk';
    } else {
      const delta = turnAngle(heading, h0);
      if (Math.abs(delta) < STRAIGHT_DEG) {
        const prev = steps[steps.length - 1];
        if (prev && prev.edgeName === p.name && prev.floor === p.floorFrom && prev.type !== 'start') {
          prev.distanceMeters += dist;
          prev.coords = [...prev.coords, ...p.coords.slice(1)];
          heading = h1;
          continue;
        }
        lead = 'Continue straight';
      } else {
        const t = turnWord(delta);
        lead = t.text;
        type = t.type;
      }
    }

    // Sub-3 m slivers (snapping artefacts) are folded into the previous step instead of getting their own
    const prevStep = steps[steps.length - 1];
    if (dist < 3 && !isDoor && !p.spur && !isLanding && prevStep && !['start', 'stairs-up', 'stairs-down', 'arrive'].includes(prevStep.type) && prevStep.floor === p.floorFrom && !isLast) {
      prevStep.distanceMeters += dist;
      prevStep.coords = [...prevStep.coords, ...p.coords.slice(1)];
      heading = h1;
      continue;
    }

    const spurLabel = p.spur ? p.name.split(' — ')[1] || p.name : '';
    let instruction;
    if (p.spur && pieces[i + 1]?.kind === 'stairs') instruction = `${lead} to the staircase`;
    else if (p.spur) instruction = afterVertical ? lead : `${lead} toward ${spurLabel}`;
    else if (isDoor) instruction = isFirst && type === 'start-walk' ? lead : `${lead} to ${p.name}`;
    else if (isLanding) instruction = afterVertical ? lead : `${lead} to ${p.name}`;
    else instruction = `${lead} along ${p.name}`;

    add({
      type: type === 'start-walk' ? 'straight' : type,
      instruction: instruction.replace(/\s+/g, ' '),
      distanceMeters: dist,
      bearing: h0,
      floor: p.floorFrom,
      coordinate: p.coords[0],
      coords: p.coords,
      edgeName: p.name,
    });
    heading = h1;
    afterVertical = false;
  }

  const endCoord = pieces.length ? pieces[pieces.length - 1].coords.slice(-1)[0] : startCoord;
  add({
    type: 'arrive',
    instruction: ctx.arriveText || `You have arrived at ${ctx.toLabel}`,
    floor: ctx.endFloor ?? pieces[pieces.length - 1]?.floorTo ?? 1,
    coordinate: endCoord,
    coords: [endCoord],
  });

  // Ordered legs: consecutive walking pieces on one floor form one polyline
  const legs = [];
  const stairMarkers = [];
  for (const p of pieces) {
    if (p.kind === 'stairs') {
      stairMarkers.push({ floor: p.floorFrom, toFloor: p.floorTo, coordinate: p.coords[0], name: p.stairName || p.name });
      stairMarkers.push({ floor: p.floorTo, toFloor: p.floorFrom, coordinate: p.coordTo, name: p.stairName || p.name });
      continue;
    }
    const last = legs[legs.length - 1];
    if (last && last.floor === p.floorFrom) last.coords = [...last.coords, ...p.coords.slice(1)];
    else legs.push({ floor: p.floorFrom, coords: [...p.coords] });
  }

  const floors = [];
  steps.forEach((s) => {
    [s.floor, s.floorTo].forEach((f) => {
      if (f && !floors.includes(f)) floors.push(f);
    });
  });

  return {
    distanceMeters: Math.round(pieces.reduce((s, p) => s + (p.kind === 'stairs' ? 0 : lineLength(p.coords)), 0)),
    durationSeconds: Math.round(pieces.reduce((s, p) => s + p.cost, 0)),
    coordinates: legs.flatMap((l) => l.coords),
    legs,
    floors,
    stairMarkers,
    steps,
    start: { coordinate: startCoord, floor: steps[0].floor },
    end: { coordinate: endCoord, floor: steps[steps.length - 1].floor },
  };
}
