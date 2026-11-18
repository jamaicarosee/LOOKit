// Loads and caches all static GeoJSON (same fetch('/data/...') approach as the dashboard map)

import { FLOORS } from '../constants';

let cache = null;

async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return res.json();
}

async function loadAll() {
  const [campus, site, macroPaths] = await Promise.all([
    getJson('/data/macro/rtu_pasig_campus.geojson'),
    getJson('/data/macro/site_features.geojson'),
    getJson('/data/macro/paths.geojson'),
  ]);

  // A missing floor must not break the whole app
  const settled = await Promise.allSettled(
    FLOORS.flatMap((n) => [
      getJson(`/data/floor${n}/buildings_f${n}.geojson`),
      getJson(`/data/floor${n}/paths_f${n}.geojson`),
      getJson(`/data/floor${n}/structures_f${n}.json`),
    ]),
  );
  const val = (i) => (settled[i].status === 'fulfilled' ? settled[i].value : null);
  const floors = {};
  FLOORS.forEach((n, i) => {
    floors[n] = { rooms: val(i * 3), paths: val(i * 3 + 1), structures: val(i * 3 + 2) };
  });

  return { campus, site, macroPaths, floors };
}

// Resolves once; a failure clears the cache so "Retry" works
export function fetchCampusData() {
  if (!cache) {
    cache = loadAll().catch((err) => {
      cache = null;
      throw err;
    });
  }
  return cache;
}
