const STORAGE_KEY = 'lookit_offline_routes_v1';
const MAX_CACHED_ROUTES = 15;

export class OfflineRouteError extends Error {
  constructor(message = 'You are offline. Connect to the internet to search for a new route.') {
    super(message);
    this.name = 'OfflineRouteError';
    this.code = 'OFFLINE_ROUTE_UNAVAILABLE';
  }
}

function normalizeEndpoint(loc) {
  if (!loc) return 'none';
  const id = loc.id ?? loc.code ?? loc.name ?? 'unknown';
  return `${String(id).toLowerCase()}:f${loc.floor || 1}`;
}

export function buildRouteCacheKey(from, to, options = {}) {
  const fromKey = normalizeEndpoint(from);
  const toKey = options.emergency ? 'emergency-exit' : normalizeEndpoint(to);
  const pwdKey = options.pwd ? 'pwd' : 'std';
  const emgKey = options.emergency ? 'emg' : 'norm';
  return `${fromKey}__${toKey}__${pwdKey}__${emgKey}`;
}

function readStore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    // Ignore routes cached back when "Current Location" existed (their keys start with "gps:")
    return Array.isArray(parsed) ? parsed.filter((item) => !String(item?.key || '').startsWith('gps:')) : [];
  } catch {
    return [];
  }
}

function writeStore(entries) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_CACHED_ROUTES)));
  } catch {
    // Ignore storage quota errors gracefully
  }
}

export function getCachedRoute(from, to, options = {}) {
  const key = buildRouteCacheKey(from, to, options);
  const entries = readStore();
  const hit = entries.find((item) => item.key === key);
  return hit ? { ...hit.route, fromOfflineCache: true } : null;
}

export function saveCachedRoute(from, to, options = {}, route) {
  if (!route) return;
  const key = buildRouteCacheKey(from, to, options);
  const entries = readStore().filter((item) => item.key !== key);
  entries.unshift({
    key,
    savedAt: Date.now(),
    route,
  });
  writeStore(entries);
}

export function clearRouteCache() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // No-op
  }
}