// Route computation: resolves locations to graph nodes, runs Dijkstra and builds steps.
// getRoute() is the only entry point the UI uses, so a FastAPI backend can replace it later.

import axios from 'axios';
import { USE_REMOTE_ROUTING, API_BASE_URL } from '../constants';
import { fetchCampusData } from './dataService';
import { buildGraph, shortestPath, nodesNearGeometry } from './graph';
import { buildRouteResult } from './stepBuilder';
import { buildingAtFactory } from './locationService';
import { haversine, pointInPolygon } from './geo';

const EMERGENCY_EXITS = ['Gate 1', 'Gate 2'];

let graphPromise = null;

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

// --- Location -> graph nodes (several nodes per gate / building so one-way dead ends never trap a route) ---

function resolveNodes(graph, loc) {
  if (loc.type === 'room') {
    const own = graph.tags.get(`room:${loc.id}`);
    if (own !== undefined) return { ids: [own], exact: true };
  }
  if (loc.geometry) {
    const ids = nodesNearGeometry(graph, loc.geometry);
    if (ids.length) return { ids, exact: loc.type !== 'room' };
  }
  // Rooms without a mapped door fall back to their building's ground-floor entrance
  const b = loc.building && graph.buildingGeometry?.get(loc.building);
  const ids = b ? nodesNearGeometry(graph, b) : [];
  return { ids, exact: false };
}

// --- Local routing ---

async function getLocalRoute(from, to, options) {
  const { graph, buildingAt, raw } = await getGraph();
  const { emergency = false, pwd = false } = options;

  const src = resolveNodes(graph, from);
  if (!src.ids.length) return null;
  const warnings = [];
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

  // Step-free first; fall back to stairs with a clear warning when the data has no accessible link
  let mode = { avoidStairs: pwd };
  let path = shortestPath(graph, src.ids, targets, mode);
  if (!path && pwd) {
    mode = { avoidStairs: false };
    path = shortestPath(graph, src.ids, targets, mode);
    if (path) warnings.push('No step-free route exists in the campus data (no elevator or ramp between floors). This route uses stairs.');
  }
  if (!path) return null;

  const exitName = emergency ? exits.find((e) => e.ids.includes(path.target))?.name || 'the nearest exit' : null;
  const toLabel = emergency ? `${exitName} (emergency exit)` : to.name;
  const dest = !emergency && to.type === 'room'
    ? `${to.name}${to.fullName && to.fullName !== to.name ? ` – ${to.fullName}` : ''} (${to.building || 'building'}, Floor ${to.floor})`
    : toLabel;

  const result = buildRouteResult(path, {
    fromLabel: from.type === 'room' ? `${from.name} (${from.building}, Floor ${from.floor})` : from.name,
    toLabel,
    arriveText: emergency ? `You have reached the emergency exit at ${exitName}` : `You have arrived at ${dest}`,
    mode,
    buildingAt,
    insideBuilding: (c) => (raw.campus?.features || []).some((f) => f.properties.category !== 'outdoor_structure' && pointInPolygon(c, f.geometry)),
    startCoord: graph.nodes[path.nodeIds[0]].coord,
    startFloor: graph.nodes[path.nodeIds[0]].floor,
    startZone: from.type === 'room' ? 'indoor' : 'outdoor',
    endFloor: graph.nodes[path.target].floor,
  });

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

// --- Remote routing (kept behind the same interface) ---

async function getRemoteRoute(from, to, options) {
  const { data } = await axios.post(`${API_BASE_URL}/route`, { from, to, ...options });
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
    from,
    to,
  };
}

// Returns a RouteResult, or null when no walkable path exists. Throws only on real errors.
export async function getRoute(fromLocation, toLocation, options = {}) {
  return USE_REMOTE_ROUTING
    ? getRemoteRoute(fromLocation, toLocation, options)
    : getLocalRoute(fromLocation, toLocation, options);
}

/*
 * Sample calls (verified against the bundled GeoJSON):
 *
 *   getRoute(gate1, e501)                  -> 97 m, floors [1, 5], 12 steps incl. "Take the stairs up 4 floors to Floor 5"
 *   getRoute(gate1, e103, { pwd: true })   -> step-free: connector walkway -> PWD ramp -> M.A.E corridor
 *   getRoute(gate1, e501, { pwd: true })   -> stairs fallback + warning (no elevator/ramp between floors in the data)
 *   getRoute(e501, anything, { emergency: true }) -> nearest of Gate 1 / Gate 2, stairs allowed, 'To' ignored
 */
