// Route computation: resolves locations to graph nodes, runs Dijkstra and builds steps.

import { apiClient } from '../../../services/apiClient';
import { USE_REMOTE_ROUTING } from '../constants';
import { fetchCampusData } from './dataService';
import {
  buildGraph,
  shortestPath,
  shortestPathVia,
  shortestPathThroughRamp,
  buildingF1StairNodes,
  isPwdRampEdge,
  nodesNearGeometry,
  attachPoint,
  JAVIER_BUILDING,
  JAVIER_LOBBY_TAG,
} from './graph';
import {
  getCachedRoute,
  saveCachedRoute,
  OfflineRouteError,
} from '../../offline/services/routeCache';
import { buildRouteResult } from './stepBuilder';
import { buildingAtFactory } from './locationService';
import { haversine, pointInPolygon } from './geo';

const EMERGENCY_EXITS = ['Gate 1', 'Gate 2'];

let graphPromise = null;

function inferBuildingName(s) {
  const n = (s || '').toLowerCase();
  if (/\b(mae|m\.a\.e)\b/.test(n)) return 'M.A.E Building';
  if (/\b(ced|pced)\b/.test(n)) return 'CED Building';
  if (/\b(cas|pcasmab|storage)\b/.test(n)) return 'CAS Building';
  if (/\b(javier|jav|lobby)\b/.test(n)) return 'Javier Building';
  return null;
}

function getBuildingPwdRamps(graph, building) {
  if (!building) return [];
  const norm = inferBuildingName(building) || building;
  return graph.edges.filter((e) => {
    if (!isPwdRampEdge(e) || (e.floor || 1) !== 1 || e.floorTo || e.virtual) return false;
    const eb = inferBuildingName(e.building) || e.building || inferBuildingName(e.name);
    return eb === norm;
  });
}

function withBuildings(graph, raw) {
  graph.buildingGeometry = new Map((raw.campus?.features || []).map((f) => [f.properties.name, f.geometry]));
  return graph;
}

function getGraph() {
  if (!graphPromise) {
    graphPromise = fetchCampusData()
      .then((raw) => ({ raw, graph: withBuildings(buildGraph(raw), raw), buildingAt: buildingAtFactory(raw.campus?.features || []) }))
      .catch((err) => {
        graphPromise = null;
        throw err;
      });
  }
  return graphPromise;
}

export function preloadRoutingGraph() {
  return getGraph().then(() => true);
}

function resolveNodes(graph, loc) {
  const floor = loc.floor || 1;
  if (loc.type === 'room') {
    const own = graph.tags.get(`room:${loc.id}`) ?? (loc.code ? graph.tags.get(`room:${loc.code}`) : undefined);
    if (own !== undefined) return { ids: [own], exact: true };
    const coord = loc.coordinates || loc.coordinate;
    if (Array.isArray(coord)) {
      const snap = attachPoint(graph, coord, { floor, maxSnapM: 25 });
      if (snap) {
        graph.nodes = snap.graph.nodes;
        graph.edges = snap.graph.edges;
        graph.adj = snap.graph.adj;
        return { ids: [snap.sourceId], exact: true };
      }
    }
  }
  if (loc.geometry) {
    const ids = nodesNearGeometry(graph, loc.geometry, { floor });
    if (ids.length) return { ids, exact: loc.type !== 'room' };
  }
  const b = loc.building && graph.buildingGeometry?.get(loc.building);
  const ids = b ? nodesNearGeometry(graph, b, { floor: 1 }) : [];
  return { ids, exact: false };
}

const JAVIER_AREA = new Set([JAVIER_BUILDING, 'Gymnasium', 'Garden']);
const inJavier = (loc) => JAVIER_AREA.has(loc?.building);

function findPath(graph, from, to, emergency, sources, targets, mode) {
  const lobby = graph.tags.get(JAVIER_LOBBY_TAG);
  const sameBuildingAndFloor =
    from?.building &&
    to?.building &&
    from.building === to.building &&
    (from.floor || 1) === (to.floor || 1);

  if (sameBuildingAndFloor) {
    return shortestPath(graph, sources, targets, mode);
  }

  // PWD mode: enforce 1F PWD ramps when exiting or entering any ramp-equipped building
  if ((mode.avoidStairs || mode.preferRamps) && !emergency) {
    const fromB = from?.building ? (inferBuildingName(from.building) || from.building) : null;
    const toB = to?.building ? (inferBuildingName(to.building) || to.building) : null;
    const fromRamps = fromB && fromB !== toB ? getBuildingPwdRamps(graph, fromB) : [];
    const toRamps = toB && fromB !== toB ? getBuildingPwdRamps(graph, toB) : [];

    if (fromRamps.length && toRamps.length) {
      let best = null;
      for (const r1 of fromRamps) {
        const leg1 = shortestPathThroughRamp(graph, sources, [r1], [r1.a, r1.b], mode);
        if (!leg1) continue;
        const leg2 = shortestPathThroughRamp(graph, [leg1.target], toRamps, targets, mode);
        if (!leg2) continue;
        const cost = leg1.cost + leg2.cost;
        if (!best || cost < best.cost) {
          best = {
            nodeIds: [...leg1.nodeIds, ...leg2.nodeIds.slice(1)],
            steps: [...leg1.steps, ...leg2.steps],
            cost,
            target: leg2.target,
          };
        }
      }
      if (best) return best;
    }

    if (toRamps.length) {
      const p = shortestPathThroughRamp(graph, sources, toRamps, targets, mode);
      if (p) return p;
    }

    if (fromRamps.length) {
      const p = shortestPathThroughRamp(graph, sources, fromRamps, targets, mode);
      if (p) return p;
    }
  }

  if (!emergency && lobby !== undefined && inJavier(from) !== inJavier(to)) {
    return shortestPathVia(graph, sources, lobby, targets, mode);
  }
  return shortestPath(graph, sources, targets, mode);
}

async function getLocalRoute(from, to, options) {
  const base = await getGraph();
  const { buildingAt, raw } = base;
  const { graph } = base;
  const { emergency = false, pwd = false } = options;
  const warnings = [];

  const src = resolveNodes(graph, from);
  if (!src.ids.length) return null;
  if (!src.exact) warnings.push(`Indoor path to ${from.name} is not mapped; the route starts at the ${from.building || 'building'} entrance.`);

  let targets;
  let exits = [];
  if (emergency) {
    exits = EMERGENCY_EXITS.map((name) => {
      const f = (raw.site?.features || []).find((x) => x.properties.name === name);
      return { name, ids: f ? nodesNearGeometry(graph, f.geometry) : [] };
    });
    targets = exits.flatMap((e) => e.ids);
    if (!targets.length) return null;
  } else {
    const dst = resolveNodes(graph, to);
    if (!dst.ids.length) return null;
    targets = dst.ids;
    if (!dst.exact) warnings.push(`Indoor path to ${to.name} is not mapped; the route ends at the ${to.building || 'building'} entrance.`);
  }

  const srcFloor = from?.floor || 1;
  const dstFloor = !emergency && to ? (to.floor || 1) : 1;

  // In PWD mode: if user starts on an upper floor (e.g., LMSU 2F), allow descending stairs inside their starting building only
  const baseMode = {
    avoidStairs: pwd,
    preferRamps: pwd,
    stairBuildings: pwd && srcFloor > 1 && from?.building ? [from.building] : [],
  };

  let mode = baseMode;
  let pwdUpperBlocked = false;
  let path = findPath(graph, from, to, emergency, src.ids, targets, mode);

  // PWD upper-floor destination (2F+): route via 1F PWD ramps and stop at destination building's 1st-floor stairs + validation
  if (!path && pwd && !emergency && to && dstFloor > 1) {
    const destBldg = to.building;
    const stairIds = buildingF1StairNodes(graph, destBldg);
    const bRamps = destBldg ? getBuildingPwdRamps(graph, destBldg) : [];
    const f1Targets = stairIds.length
      ? stairIds
      : bRamps.length
        ? [...new Set(bRamps.flatMap((e) => [e.a, e.b]))]
        : (raw.campus?.features || [])
            .filter((f) => f.properties?.name === destBldg)
            .flatMap((f) => nodesNearGeometry(graph, f.geometry, { floor: 1 }));

    if (f1Targets.length) {
      path = findPath(graph, from, { ...to, floor: 1 }, false, src.ids, f1Targets, baseMode);
      if (path) {
        pwdUpperBlocked = true;
      }
    }
  }

  // Standard fallback if standard mode had no path without ramps
  if (!path && !pwd) {
    mode = { avoidStairs: false, allowRamps: true };
    path = findPath(graph, from, to, emergency, src.ids, targets, mode);
  }

  if (!path) return null;

  const exitName = emergency ? exits.find((e) => e.ids.includes(path.target))?.name || 'the nearest exit' : null;
  const toLabel = emergency ? `${exitName} (emergency exit)` : to.name;
  const dest = !emergency && to.type === 'room'
    ? `${to.name}${to.fullName && to.fullName !== to.name ? ` – ${to.fullName}` : ''} (${to.building || 'building'}, Floor ${to.floor})`
    : toLabel;

  const fromDisplay = from.type === 'room'
    ? `${from.name} (${from.building}, Floor ${from.floor})`
    : from.name;

  const result = buildRouteResult(path, {
    fromLabel: fromDisplay,
    toLabel,
    arriveText: emergency ? `You have reached the emergency exit at ${exitName}` : `You have arrived at ${dest}`,
    mode,
    buildingAt,
    insideBuilding: (c) => (raw.campus?.features || []).some((f) => f.properties.category !== 'outdoor_structure' && pointInPolygon(c, f.geometry)),
    startCoord: graph.nodes[path.nodeIds[0]].coord,
    startFloor: graph.nodes[path.nodeIds[0]].floor,
    startZone: from.type === 'room' || srcFloor > 1 ? 'indoor' : 'outdoor',
    endFloor: graph.nodes[path.target].floor,
  });

  if (pwd && srcFloor > 1 && Array.isArray(result.steps) && result.steps.length) {
    const downMsg = `You are starting on Floor ${srcFloor}. Take the stairs down to the 1st floor, then follow the accessible PWD ramp route.`;
    warnings.push(downMsg);
    result.steps.splice(1, 0, {
      id: 'step-pwd-start-note',
      distanceMeters: 0,
      bearing: null,
      type: 'note',
      instruction: `Validation: ${downMsg}`,
      floor: srcFloor,
      coordinate: result.steps[0]?.coordinate,
      coords: result.steps[0]?.coordinate ? [result.steps[0].coordinate] : [],
    });
    result.steps.forEach((st, idx) => { st.id = `step-${idx}`; });
  }

  if (pwdUpperBlocked && to) {
    const bldgLabel = to.building || 'the destination building';
    const valMsg = `Cannot proceed up to Floor ${to.floor} (${to.name}) — there is no PWD ramp or elevator going upstairs in ${bldgLabel}.`;
    warnings.push(valMsg);
    if (Array.isArray(result.steps) && result.steps.length) {
      const lastSt = result.steps[result.steps.length - 1];
      lastSt.instruction = `Stop at ${bldgLabel} 1st-Floor Stairs — ${valMsg}`;
      result.steps.push({
        id: `step-${result.steps.length}`,
        distanceMeters: 0,
        bearing: null,
        type: 'note',
        instruction: `Validation: ${valMsg}`,
        floor: 1,
        coordinate: lastSt.coordinate,
        coords: lastSt.coordinate ? [lastSt.coordinate] : [],
      });
    }
  }

  if (path.via !== undefined) {
    const lobbyCoord = graph.nodes[path.via].coord;
    const hit = result.steps.find((st) => st.coords?.some((c) => haversine(c, lobbyCoord) < 1.5));
    if (hit && !/lobby/i.test(hit.instruction)) hit.instruction += ' (through the Javier Building lobby)';
  }

  const named = new Map([...graph.tags].filter(([t]) => t.startsWith('node:')).map(([t, id]) => [id, t.slice(5)]));
  return {
    ...result,
    nodes: path.nodeIds.map((id) => named.get(id)).filter(Boolean),
    warnings,
    options: { emergency, pwd },
    from,
    to: emergency ? { ...to, name: toLabel, type: 'gate', floor: 1 } : to,
  };
}

async function getRemoteRoute(from, to, options) {
  const { data } = await apiClient.post('/api/navigation/route', {
    from,
    to,
    ...options,
  });
  if (!data) return null;
  return {
    distanceMeters: data.distanceMeters,
    durationSeconds: data.durationSeconds,
    coordinates: data.coordinates || [],
    legs: data.legs || [{ floor: 1, coords: data.coordinates || [] }],
    floors: data.floors || [1],
    stairMarkers: data.stairMarkers || [],
    nodes: data.nodes || [],
    steps: data.steps || [],
    start: data.start,
    end: data.end,
    warnings: data.warnings || [],
    options,
    from: data.from || from,
    to: data.to || to,
  };
}

export async function getRoute(fromLocation, toLocation, options = {}) {
  const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;

  // Option A: Offline serves previously cached routes only; block brand-new route searches
  if (isOffline) {
    const cached = getCachedRoute(fromLocation, toLocation, options);
    if (cached) return cached;
    throw new OfflineRouteError();
  }

  let route = null;
  if (!USE_REMOTE_ROUTING) {
    route = await getLocalRoute(fromLocation, toLocation, options);
  } else {
    try {
      route = await getRemoteRoute(fromLocation, toLocation, options);
    } catch (err) {
      console.warn('[LOOKit Routing] FastAPI unreachable, falling back to local graph:', err.message);
      route = await getLocalRoute(fromLocation, toLocation, options);
    }
  }

  if (route) {
    saveCachedRoute(fromLocation, toLocation, options, route);
  }

  return route;
}
