// Searchable locations: buildings, gates, parking and every room on every floor

import { fetchCampusData } from './dataService';
import { assignRoomIds } from './graph';
import { polygonCentroid, pointInPolygon, haversine } from './geo';
import { FLOORS } from '../constants';

let indexPromise = null;

// Room data says "Canteen Wing"; the campus polygon is "Canteen"
const BUILDING_ALIASES = { 'Canteen Wing': 'Canteen' };

function levenshtein(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      rowMin = Math.min(rowMin, cur[j]);
    }
    if (rowMin > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

const norm = (s) => (s || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

function buildIndex(raw) {
  const list = [];
  const campusFeatures = raw.campus?.features || [];

  const buildingFor = (name, coord) => {
    if (name && BUILDING_ALIASES[name]) return BUILDING_ALIASES[name];
    const hit = campusFeatures.find((f) => f.properties.category === 'building' && f.properties.name === name);
    if (hit) return hit.properties.name;
    const inside = campusFeatures.find((f) => f.properties.category !== 'outdoor_structure' && pointInPolygon(coord, f.geometry));
    return inside ? inside.properties.name : name || null;
  };

  // --- Buildings and amenities ---
  campusFeatures.forEach((f) => {
    const p = f.properties;
    list.push({
      id: `building:${p.name}`,
      name: p.label || p.name,
      fullName: p.name,
      type: 'building',
      building: p.name,
      floor: null,
      floors: p.floors || 0,
      coordinates: polygonCentroid(f.geometry),
      geometry: f.geometry,
      keywords: norm(`${p.name} ${p.label} ${p.amenity || ''} ${p.category || ''}`),
    });
  });

  // --- Gates and parking ---
  (raw.site?.features || []).forEach((f) => {
    const p = f.properties;
    const isGate = p.category === 'gate';
    list.push({
      id: `${isGate ? 'gate' : 'parking'}:${p.name}`,
      name: p.name,
      fullName: p.name,
      type: isGate ? 'gate' : 'parking',
      building: null,
      floor: 1,
      coordinates: polygonCentroid(f.geometry),
      geometry: f.geometry,
      keywords: norm(`${p.name} ${isGate ? 'gate entrance exit' : 'parking lot'}`),
    });
  });

  // --- Rooms (ids shared with the routing graph) ---
  const ids = assignRoomIds(raw);
  FLOORS.forEach((floor) => {
    (raw.floors?.[floor]?.rooms?.features || []).forEach((f) => {
      const p = f.properties;
      const coordinates = polygonCentroid(f.geometry);
      list.push({
        id: ids.get(f),
        name: p.name || p.label || p.code,
        fullName: p.full_name || p.description || p.name,
        type: 'room',
        building: buildingFor(p.building, coordinates),
        floor,
        category: p.category || null,
        code: p.code,
        coordinates,
        keywords: norm(`${p.code} ${p.label} ${p.acronym || ''} ${p.category || ''} ${p.building || ''}`),
      });
    });
  });

  return { list, byId: new Map(list.map((l) => [l.id, l])), campusFeatures };
}

export function loadLocations() {
  if (!indexPromise) {
    indexPromise = fetchCampusData()
      .then(buildIndex)
      .catch((err) => {
        indexPromise = null;
        throw err;
      });
  }
  return indexPromise;
}

// --- Ranking: exact > prefix > word-prefix > substring > fuzzy ---

const TYPE_RANK = { building: 0, gate: 0, parking: 1, room: 2 };

function scoreEntry(loc, q) {
  const fields = [norm(loc.name), norm(loc.fullName), norm(loc.building)];
  let best = 0;
  for (const f of fields) {
    if (!f) continue;
    if (f === q) best = Math.max(best, 100);
    else if (f.startsWith(q)) best = Math.max(best, 80);
    else if (f.split(' ').some((w) => w.startsWith(q))) best = Math.max(best, 65);
    else if (f.includes(q)) best = Math.max(best, 50);
  }
  if (!best && loc.keywords.includes(q)) best = 40;
  if (!best && q.length >= 4) {
    const max = q.length >= 7 ? 2 : 1;
    const words = [...fields, loc.keywords].join(' ').split(' ').filter(Boolean);
    const d = Math.min(...words.map((w) => levenshtein(q, w.slice(0, q.length + 1), max)));
    if (d <= max) best = 30 - d * 5;
  }
  return best;
}

export async function search(query, { limit = 8 } = {}) {
  const { list } = await loadLocations();
  const q = norm(query);
  if (!q) {
    return list.filter((l) => l.type === 'building' || l.type === 'gate').slice(0, 5);
  }
  return list
    .map((loc) => ({ loc, score: scoreEntry(loc, q) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || TYPE_RANK[a.loc.type] - TYPE_RANK[b.loc.type] || a.loc.name.localeCompare(b.loc.name))
    .slice(0, limit)
    .map((r) => r.loc);
}

export async function getAll() {
  return (await loadLocations()).list;
}

export async function getById(id) {
  return (await loadLocations()).byId.get(id) || null;
}

// Rooms of one building, grouped by floor (feeds the Directory panel)
export async function getBuildingDirectory(buildingName) {
  const { list } = await loadLocations();
  const rooms = list.filter((l) => l.type === 'room' && l.building === buildingName);
  const byFloor = new Map();
  rooms.forEach((r) => byFloor.set(r.floor, [...(byFloor.get(r.floor) || []), r]));
  return [...byFloor.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([floor, items]) => ({ floor, rooms: items.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })) }));
}

// Nearest building polygon name for a coordinate (null when far from everything)
export function buildingAtFactory(campusFeatures) {
  const features = campusFeatures.filter((f) => f.properties.category !== 'outdoor_structure');
  return (coord) => {
    const inside = features.find((f) => pointInPolygon(coord, f.geometry));
    if (inside) return inside.properties.name;
    let best = null;
    features.forEach((f) => {
      const d = haversine(coord, polygonCentroid(f.geometry));
      if (d < 25 && (!best || d < best.d)) best = { d, name: f.properties.name };
    });
    return best ? best.name : null;
  };
}

// Buildings that have room data, in campus order (feeds the Directory building chips)
export async function getDirectoryBuildings() {
  const { list } = await loadLocations();
  const order = ['M.A.E Building', 'CED Building', 'CAS Building', 'Javier Building', 'Canteen'];
  const present = new Set(list.filter((l) => l.type === 'room' && l.building).map((l) => l.building));
  return [...order.filter((b) => present.has(b)), ...[...present].filter((b) => !order.includes(b))];
}
