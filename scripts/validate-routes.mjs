// Run after replacing files in public/data:  npm run check:routes
// Rebuilds the routing graph from the GeoJSON and reports anything that would break routing.
import fs from 'node:fs';
import { buildGraph, shortestPath, nodesNearGeometry } from '../src/features/navigation/services/graph.js';
import { haversine } from '../src/features/navigation/services/geo.js';

const D = new URL('../public/data/', import.meta.url);
const rd = (f) => { try { return JSON.parse(fs.readFileSync(new URL(f, D), 'utf8')); } catch { return null; } };
const floors = {};
for (let n = 1; n <= 6; n++) floors[n] = { rooms: rd(`floor${n}/buildings_f${n}.geojson`), paths: rd(`floor${n}/paths_f${n}.geojson`), structures: rd(`floor${n}/structures_f${n}.json`) };
const raw = { macroPaths: rd('macro/paths.geojson'), floors };
const site = rd('macro/site_features.geojson');

const g = buildGraph(raw);
const kinds = {};
g.edges.forEach((e) => { kinds[e.kind] = (kinds[e.kind] || 0) + 1; });
console.log(`graph: ${g.nodes.length} nodes, ${g.edges.length} edges`, kinds);

const gateFeature = site.features.find((f) => f.properties.name === 'Gate 1');
const gates = nodesNearGeometry(g, gateFeature.geometry);
const gate = gates[0];
const rooms = [...g.tags].filter(([t]) => t.startsWith('room:'));
const lost = rooms.filter(([, n]) => !shortestPath(g, gates, [n]));
console.log(`rooms: ${rooms.length} routable of ${g.roomIds.size} (${lost.length} unreachable from Gate 1)`);
lost.slice(0, 20).forEach(([t]) => console.log('  unreachable', t));

// Detours: path length vs straight line, flagged above 3x (likely a gap or one-way mistake)
let flagged = 0;
for (const [t, n] of rooms) {
  const r = shortestPath(g, gates, [n]);
  if (!r) continue;
  const len = r.steps.reduce((s, x) => s + (x.edge.kind === 'stairs' ? 0 : x.edge.len), 0);
  const straight = haversine(g.nodes[gate].coord, g.nodes[n].coord);
  if (straight > 30 && len > straight * 3 && flagged++ < 10) console.log(`  detour ${t}: ${Math.round(len)} m vs ${Math.round(straight)} m straight`);
}
console.log(`detours flagged: ${flagged}`);
process.exit(lost.length ? 1 : 0);
