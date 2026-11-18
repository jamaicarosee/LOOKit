// 100% Live Backend-backed Searchable Locations Service
import { apiClient } from '../../../services/apiClient';
import { polygonCentroid, pointInPolygon, haversine } from './geo';
<<<<<<< HEAD
=======
import { CURRENT_LOCATION_ID, CURRENT_LOCATION_LABEL } from '../constants';

// "Current Location (GPS)" is a pseudo-location. The From field holds this stable entry; the live
// coordinates are merged in by makeLiveLocation() on every GPS fix (see useRouteInputs).
export const CURRENT_LOCATION = {
  id: CURRENT_LOCATION_ID,
  name: CURRENT_LOCATION_LABEL,
  type: 'gps',
  building: null,
  floor: 1,
  isCurrentLocation: true,
};

export function makeLiveLocation({ coord, accuracy, heading }) {
  return { ...CURRENT_LOCATION, coordinate: coord, accuracy, heading, geometry: { type: 'Point', coordinates: coord } };
}
>>>>>>> 73e09d3 (added skeletal loading and current location)

let locationsPromise = null;

// Immediately clears cache when Map Editor saves
export function invalidateLocationCache() {
  locationsPromise = null;
}

const norm = (s) => (s || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

export async function loadLocations(forceRefresh = false) {
  if (!locationsPromise || forceRefresh) {
    locationsPromise = apiClient
      .get('/api/navigation/locations', { params: { all_items: true, _t: Date.now() } })
      .then((res) => {
        const list = res.data?.locations || [];
        const byId = new Map(list.map((l) => [String(l.id || l.code), l]));
        return { list, byId };
      })
      .catch((err) => {
        locationsPromise = null;
        throw err;
      });
  }
  return locationsPromise;
}

export async function search(query, { limit = 8 } = {}) {
  const trimmed = (query || '').trim();
  try {
    // Dynamic query with timestamp to bust HTTP caches
    const res = await apiClient.get('/api/navigation/locations', {
      params: trimmed ? { q: trimmed, limit, _t: Date.now() } : { limit: 5, _t: Date.now() },
    });
    if (res.data?.locations) {
      return res.data.locations;
    }
  } catch (err) {
    console.warn('[LOOKit LocationService] Live search endpoint failed, falling back to cached index:', err);
  }

  // Graceful fallback
  const { list } = await loadLocations();
  const q = norm(query);
  if (!q) {
    return list.filter((l) => l.type === 'building' || l.type === 'gate').slice(0, 5);
  }
  return list
    .filter((l) => {
      const name = norm(l.name);
      const full = norm(l.fullName);
      const bldg = norm(l.building);
      return name.includes(q) || full.includes(q) || bldg.includes(q) || norm(l.code).includes(q);
    })
    .slice(0, limit);
}

export async function getAll() {
  return (await loadLocations()).list;
}

export async function getById(id) {
  return (await loadLocations()).byId.get(String(id)) || null;
}

export async function getBuildingDirectory(buildingName) {
  const { list } = await loadLocations();
  const rooms = list.filter((l) => l.type === 'room' && l.building === buildingName);
  const byFloor = new Map();
  rooms.forEach((r) => byFloor.set(r.floor, [...(byFloor.get(r.floor) || []), r]));
  return [...byFloor.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([floor, items]) => ({
      floor,
      rooms: items.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })),
    }));
}

export async function getDirectoryBuildings() {
  const { list } = await loadLocations();
  const order = ['M.A.E Building', 'CED Building', 'CAS Building', 'Javier Building', 'Canteen'];
  const present = new Set(list.filter((l) => l.type === 'room' && l.building).map((l) => l.building));
  return [...order.filter((b) => present.has(b)), ...[...present].filter((b) => !order.includes(b))];
}

export function buildingAtFactory(campusFeatures = []) {
  const features = (campusFeatures || []).filter((f) => f.properties?.category !== 'outdoor_structure');
  return (coord) => {
    if (!coord) return null;
    const inside = features.find((f) => f.geometry && pointInPolygon(coord, f.geometry));
    if (inside) return inside.properties?.name || null;
    let best = null;
    features.forEach((f) => {
      if (!f.geometry) return;
      const d = haversine(coord, polygonCentroid(f.geometry));
      if (d < 25 && (!best || d < best.d)) best = { d, name: f.properties?.name || null };
    });
    return best ? best.name : null;
  };
}