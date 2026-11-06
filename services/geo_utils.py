"""
Pure geographic and planar geometry utilities for LOOKit.
1-to-1 port of src/features/navigation/services/geo.js
"""

import math
from typing import Any, Dict, List, Optional, Sequence, Tuple

EARTH_RADIUS_M = 6371008.8
RTU_PASIG_CENTER = (121.09999, 14.57309)

COMPASS = [
    "north",
    "northeast",
    "east",
    "southeast",
    "south",
    "southwest",
    "west",
    "northwest",
]


def to_rad(deg: float) -> float:
    return (deg * math.pi) / 180.0


def to_deg(rad: float) -> float:
    return (rad * 180.0) / math.pi


def haversine(a: Sequence[float], b: Sequence[float]) -> float:
    """Great-circle distance in meters between two [lng, lat] points."""
    d_lat = to_rad(b[1] - a[1])
    d_lng = to_rad(b[0] - a[0])
    h = (
        math.sin(d_lat / 2.0) ** 2
        + math.cos(to_rad(a[1])) * math.cos(to_rad(b[1])) * (math.sin(d_lng / 2.0) ** 2)
    )
    return 2.0 * EARTH_RADIUS_M * math.asin(min(1.0, math.sqrt(h)))


def line_length(coords: Sequence[Sequence[float]]) -> float:
    """Summed haversine length of a [[lng, lat], ...] polyline in meters."""
    total = 0.0
    for i in range(1, len(coords)):
        total += haversine(coords[i - 1], coords[i])
    return total


def bearing(a: Sequence[float], b: Sequence[float]) -> float:
    """Initial compass bearing (0-360, 0 = north) from point a to point b."""
    y = math.sin(to_rad(b[0] - a[0])) * math.cos(to_rad(b[1]))
    x = (
        math.cos(to_rad(a[1])) * math.sin(to_rad(b[1]))
        - math.sin(to_rad(a[1])) * math.cos(to_rad(b[1])) * math.cos(to_rad(b[0] - a[0]))
    )
    return (to_deg(math.atan2(y, x)) + 360.0) % 360.0


def turn_angle(a: float, b: float) -> float:
    """Signed smallest turn from heading a to heading b in (-180, 180]; positive = right."""
    d = ((b - a + 540.0) % 360.0) - 180.0
    if d == -180.0:
        d = 180.0
    return d


def compass_name(deg: float) -> str:
    idx = int(round((((deg % 360.0) + 360.0) % 360.0) / 45.0)) % 8
    return COMPASS[idx]


# --- Local metric projection centered on RTU Pasig ---
_KX = (math.pi / 180.0) * EARTH_RADIUS_M * math.cos(to_rad(RTU_PASIG_CENTER[1]))
_KY = (math.pi / 180.0) * EARTH_RADIUS_M


def to_xy(p: Sequence[float]) -> List[float]:
    return [(p[0] - RTU_PASIG_CENTER[0]) * _KX, (p[1] - RTU_PASIG_CENTER[1]) * _KY]


def to_lng_lat(xy: Sequence[float]) -> List[float]:
    return [RTU_PASIG_CENTER[0] + xy[0] / _KX, RTU_PASIG_CENTER[1] + xy[1] / _KY]


def project_on_segment(p: Sequence[float], a: Sequence[float], b: Sequence[float]) -> Dict[str, Any]:
    """Closest point on segment a-b to p. Returns { point, t, distance }."""
    P = to_xy(p)
    A = to_xy(a)
    B = to_xy(b)
    dx = B[0] - A[0]
    dy = B[1] - A[1]
    len2 = dx * dx + dy * dy
    if len2 == 0.0:
        t = 0.0
    else:
        t = max(0.0, min(1.0, ((P[0] - A[0]) * dx + (P[1] - A[1]) * dy) / len2))
    q = [A[0] + t * dx, A[1] + t * dy]
    dist = math.hypot(P[0] - q[0], P[1] - q[1])
    return {"point": to_lng_lat(q), "t": t, "distance": dist}


def project_on_line(p: Sequence[float], coords: Sequence[Sequence[float]]) -> Optional[Dict[str, Any]]:
    """Closest point on a polyline. Returns { point, segmentIndex, t, distance }."""
    best: Optional[Dict[str, Any]] = None
    for i in range(len(coords) - 1):
        r = project_on_segment(p, coords[i], coords[i + 1])
        if best is None or r["distance"] < best["distance"]:
            best = {**r, "segmentIndex": i}
    return best


def _outer_ring(geometry: Dict[str, Any]) -> List[List[float]]:
    g_type = geometry.get("type")
    coords = geometry.get("coordinates", [])
    if g_type == "Polygon":
        return coords[0]
    if g_type == "MultiPolygon":
        return coords[0][0]
    return coords


def polygon_centroid(geometry: Dict[str, Any]) -> List[float]:
    """Area-weighted polygon centroid (with fallback to vertex average)."""
    if geometry.get("type") == "Point":
        return list(geometry["coordinates"])
    ring = _outer_ring(geometry)
    if not ring:
        return list(RTU_PASIG_CENTER)
    pts = [to_xy(c) for c in ring]
    a = 0.0
    cx = 0.0
    cy = 0.0
    for i in range(len(pts) - 1):
        cross = pts[i][0] * pts[i + 1][1] - pts[i + 1][0] * pts[i][1]
        a += cross
        cx += (pts[i][0] + pts[i + 1][0]) * cross
        cy += (pts[i][1] + pts[i + 1][1]) * cross
    if abs(a) < 1e-9:
        sx = sum(c[0] for c in ring) / len(ring)
        sy = sum(c[1] for c in ring) / len(ring)
        return [sx, sy]
    return to_lng_lat([cx / (3.0 * a), cy / (3.0 * a)])


def bounds_center(b: Sequence[float]) -> List[float]:
    return [(b[0] + b[2]) / 2.0, (b[1] + b[3]) / 2.0]


def point_in_polygon(p: Sequence[float], geometry: Optional[Dict[str, Any]]) -> bool:
    """Ray-casting point-in-polygon check on outer rings."""
    if not geometry:
        return False
    g_type = geometry.get("type")
    coords = geometry.get("coordinates", [])
    if g_type == "MultiPolygon":
        rings = [c[0] for c in coords if c]
    elif g_type == "Polygon":
        rings = [coords[0]] if coords else []
    else:
        return False

    for ring in rings:
        inside = False
        j = len(ring) - 1
        for i in range(len(ring)):
            xi, yi = ring[i][0], ring[i][1]
            xj, yj = ring[j][0], ring[j][1]
            if (yi > p[1]) != (yj > p[1]):
                intersect_x = ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi
                if p[0] < intersect_x:
                    inside = not inside
            j = i
        if inside:
            return True
    return False


def distance_to_polygon(point: Sequence[float], geometry: Optional[Dict[str, Any]]) -> float:
    """Shortest distance in meters from point to polygon interior or boundary."""
    if not geometry:
        return float("inf")
    if point_in_polygon(point, geometry):
        return 0.0
    g_type = geometry.get("type")
    coords = geometry.get("coordinates", [])
    rings = [c[0] for c in coords] if g_type == "MultiPolygon" else [coords[0]]
    best = float("inf")
    for ring in rings:
        for i in range(len(ring) - 1):
            d = project_on_segment(point, ring[i], ring[i + 1])["distance"]
            if d < best:
                best = d
    return best