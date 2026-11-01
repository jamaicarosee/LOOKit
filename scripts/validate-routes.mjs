import fs from 'node:fs';
import { buildGraph, shortestPath, shortestPathVia, nodesNearGeometry, JAVIER_BUILDING, JAVIER_LOBBY_TAG } from '../src/features/navigation/services/graph.js';
import { haversine } from '../src/features/navigation/services/geo.js';

const D = new URL('../public/data/', import.meta.url);
const rd = (f) => { try { return JSON.parse(fs.readFileSync(new URL(f, D), 'utf8')); } catch { return null; } };
const floors = {};
for (let n = 1; n <= 6; n++) floors[n] = { rooms: rd(`floor${n}/buildings_f${n}.geojson`), paths: rd(`floor${n}/paths_f${n}.geojson`), structures: rd(`floor${n}/structures_f${n}.json`) };
const site = rd('macro/site_features.geojson');
const campus = rd('macro/rtu_pasig_campus.geojson');
const raw = { macroPaths: rd('macro/paths.geojson'), site, campus, floors };

let failed = false;
const fail = (msg) => { failed = true; console.log('FAIL', msg); };

const g = buildGraph(raw);
const kinds = {};
g.edges.forEach((e) => { kinds[e.kind] = (kinds[e.kind] || 0) + 1; });
console.log(`graph: ${g.nodes.length} nodes, ${g.edges.length} edges`, kinds);

const gateFeature = site.features.find((f) => f.properties.name === 'Gate 1');
const gates = nodesNearGeometry(g, gateFeature.geometry);
const gate = gates[0];
const rooms = [...g.tags].filter(([t]) => t.startsWith('room:'));

// 1. Reachability in both directions (all paths are two-way)
const lost = rooms.filter(([, n]) => !shortestPath(g, gates, [n]));
const stuck = rooms.filter(([, n]) => !shortestPath(g, [n], gates));
console.log(`rooms: ${rooms.length} routable of ${g.roomIds.size} (${lost.length} unreachable from Gate 1, ${stuck.length} cannot get back to Gate 1)`);
lost.slice(0, 20).forEach(([t]) => console.log('  unreachable', t));
if (lost.length || stuck.length) failed = true;

// 2. One-way edges exist only in the first stretch of the Gate 1 lanes
const oneway = g.edges.filter((e) => e.oneway);
const far = oneway.filter((e) => [e.a, e.b].some((n) => haversine(g.nodes[n].coord, gateFeature.geometry.coordinates[0][0]) > 60));
console.log(`one-way edges: ${oneway.length} (${[...new Set(oneway.map((e) => e.name))].join(' | ')})`);
if (!oneway.length) fail('no one-way Gate 1 lanes found');
if (far.length) fail(`${far.length} one-way edges are away from Gate 1`);

// 3. Javier Building: every route from outside passes the lobby
const lobby = g.tags.get(JAVIER_LOBBY_TAG);
if (lobby === undefined) fail('Javier lobby node not found');
else {
  const jav = rooms.filter(([t]) => /JAV/i.test(t));
  const origins = { 'Gate 1': gates, 'Gate 2': nodesNearGeometry(g, site.features.find((f) => f.properties.name === 'Gate 2').geometry) };
  let bad = 0;
  for (const [name, src] of Object.entries(origins)) {
    for (const [t, n] of jav) {
      const r = shortestPathVia(g, src, lobby, [n]);
      if (!r || !r.nodeIds.includes(lobby)) { bad++; console.log(`  no lobby route ${name} -> ${t}`); }
    }
  }
  console.log(`javier rooms via lobby: ${jav.length} rooms x ${Object.keys(origins).length} origins, ${bad} problems`);
  if (bad) failed = true;
}

// 4. Detours: path length vs straight line, flagged above 3x (likely a gap)
let flagged = 0;
for (const [t, n] of rooms) {
  const r = shortestPath(g, gates, [n]);
  if (!r) continue;
  const len = r.steps.reduce((s, x) => s + (x.edge.kind === 'stairs' ? 0 : x.edge.len), 0);
  const straight = haversine(g.nodes[gate].coord, g.nodes[n].coord);
  if (straight > 30 && len > straight * 3 && flagged++ < 10) console.log(`  detour ${t}: ${Math.round(len)} m vs ${Math.round(straight)} m straight`);
}
console.log(`detours flagged: ${flagged}`);
process.exit(failed ? 1 : 0);
