// Pure geo helpers (no React / DOM imports) so they can be unit-tested in Node.

const EARTH_RADIUS_M = 6371008.8;
const toRad = (d) => (d * Math.PI) / 180;
const toDeg = (r) => (r * 180) / Math.PI;

// --- Distances ---

// Great-circle distance in meters between two [lng, lat] points
export function haversine(a, b) {
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

// Summed haversine length of a [lng, lat][] polyline, in meters
export function lineLength(coords) {
  let total = 0;
  for (let i = 1; i < coords.length; i++) total += haversine(coords[i - 1], coords[i]);
  return total;
}

// --- Bearings ---

// Initial compass bearing (0-360, 0 = north) from a to b
export function bearing(a, b) {
  const y = Math.sin(toRad(b[0] - a[0])) * Math.cos(toRad(b[1]));
  const x =
    Math.cos(toRad(a[1])) * Math.sin(toRad(b[1])) -
    Math.sin(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.cos(toRad(b[0] - a[0]));
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

// Signed smallest turn from heading a to heading b, in (-180, 180]; positive = right
export function turnAngle(a, b) {
  let d = ((b - a + 540) % 360) - 180;
  if (d === -180) d = 180;
  return d;
}

const COMPASS = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'];
export function compassName(deg) {
  return COMPASS[Math.round((((deg % 360) + 360) % 360) / 45) % 8];
}

// --- Local metric projection (campus is ~300 m wide, so equirectangular is exact enough) ---

export function makeProjector(origin) {
  const kx = (Math.PI / 180) * EARTH_RADIUS_M * Math.cos(toRad(origin[1]));
  const ky = (Math.PI / 180) * EARTH_RADIUS_M;
  return {
    toXY: (p) => [(p[0] - origin[0]) * kx, (p[1] - origin[1]) * ky],
    toLngLat: (xy) => [origin[0] + xy[0] / kx, origin[1] + xy[1] / ky],
  };
}

const PROJ = makeProjector([121.09999, 14.57309]);
export const toXY = PROJ.toXY;
export const toLngLat = PROJ.toLngLat;

// --- Nearest-point helpers ---

// Closest point on segment a-b to p. Returns { point, t, distance } (all in lng/lat; distance in meters)
export function projectOnSegment(p, a, b) {
  const P = toXY(p);
  const A = toXY(a);
  const B = toXY(b);
  const dx = B[0] - A[0];
  const dy = B[1] - A[1];
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((P[0] - A[0]) * dx + (P[1] - A[1]) * dy) / len2));
  const q = [A[0] + t * dx, A[1] + t * dy];
  return { point: toLngLat(q), t, distance: Math.hypot(P[0] - q[0], P[1] - q[1]) };
}

// Closest point on a polyline. Returns { point, segmentIndex, t, distance }
export function projectOnLine(p, coords) {
  let best = null;
  for (let i = 0; i < coords.length - 1; i++) {
    const r = projectOnSegment(p, coords[i], coords[i + 1]);
    if (!best || r.distance < best.distance) best = { ...r, segmentIndex: i };
  }
  return best;
}

// --- Polygon helpers ---

function outerRing(geometry) {
  if (geometry.type === 'Polygon') return geometry.coordinates[0];
  if (geometry.type === 'MultiPolygon') return geometry.coordinates[0][0];
  return geometry.coordinates;
}

// Area-weighted polygon centroid (falls back to vertex average for degenerate rings)
export function polygonCentroid(geometry) {
  if (geometry.type === 'Point') return geometry.coordinates;
  const ring = outerRing(geometry);
  const pts = ring.map(toXY);
  let a = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const cross = pts[i][0] * pts[i + 1][1] - pts[i + 1][0] * pts[i][1];
    a += cross;
    cx += (pts[i][0] + pts[i + 1][0]) * cross;
    cy += (pts[i][1] + pts[i + 1][1]) * cross;
  }
  if (Math.abs(a) < 1e-9) {
    const sx = ring.reduce((s, c) => s + c[0], 0) / ring.length;
    const sy = ring.reduce((s, c) => s + c[1], 0) / ring.length;
    return [sx, sy];
  }
  return toLngLat([cx / (3 * a), cy / (3 * a)]);
}

export function boundsCenter(b) {
  return [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2];
}

// [minLng, minLat, maxLng, maxLat] of a coordinate list
export function coordsBounds(coords) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of coords) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return [minX, minY, maxX, maxY];
}

// --- Polyline sampling ---

// Point at fraction t (0-1) along a polyline, by length. Returns { point, bearing }
export function pointAlong(coords, t) {
  if (!coords.length) return null;
  if (coords.length === 1) return { point: coords[0], bearing: 0 };
  const total = lineLength(coords);
  let target = Math.max(0, Math.min(1, t)) * total;
  for (let i = 1; i < coords.length; i++) {
    const seg = haversine(coords[i - 1], coords[i]);
    if (target <= seg || i === coords.length - 1) {
      const k = seg === 0 ? 0 : Math.min(1, target / seg);
      const a = coords[i - 1];
      const b = coords[i];
      return { point: [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k], bearing: bearing(a, b) };
    }
    target -= seg;
  }
  return { point: coords[coords.length - 1], bearing: 0 };
}

// Ray-casting point-in-polygon on the outer ring
export function pointInPolygon(p, geometry) {
  const rings = geometry.type === 'MultiPolygon' ? geometry.coordinates.map((c) => c[0]) : [geometry.coordinates[0]];
  return rings.some((ring) => {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];
      if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  });
}
