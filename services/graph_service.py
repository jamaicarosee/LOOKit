"""
LOOKit Campus Navigation Graph & Location Service.
1-to-1 port of src/features/navigation/services/graph.js,
locationService.js, and routingService.js, with Supabase DB integration.
"""

import os
import re
import json
import heapq
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Set, Tuple

from database import supabase
from services.geo_utils import (
    haversine,
    line_length,
    project_on_line,
    project_on_segment,
    bounds_center,
    polygon_centroid,
    point_in_polygon,
    distance_to_polygon,
    to_xy,
    to_lng_lat,
)
from services.step_builder import build_route_result, STAIRS_LENGTH_M

FLOORS = [1, 2, 3, 4, 5, 6]

# Tunables matching graph.js
NODE_TOL_M = 0.8
SNAP_TOL_M = 3.0
STAIR_ATTACH_MAX_M = 16.0
STAIR_MATCH_MAX_M = 8.0
ROOM_ATTACH_MAX_M = 60.0
MACRO_REDUNDANT_M = 4.5
GATE1_LANE_M = 22.0

JAVIER_BUILDING = "Javier Building"
JAVIER_LOBBY_TAG = "node:JAVIER_LOBBY"
JAVIER_AREA = {JAVIER_BUILDING, "Gymnasium", "Garden"}
EMERGENCY_EXITS = ["Gate 1", "Gate 2"]

BUILDING_ALIASES = {"Canteen Wing": "Canteen"}
TYPE_RANK = {"building": 0, "gate": 0, "parking": 1, "room": 2}

GATE1_LANES = [
    {"re": re.compile(r"^Exit road", re.I), "flow": "in"},
    {"re": re.compile(r"^Entrance walkway", re.I), "flow": "out"},
]
LOBBY_LINE_RE = re.compile(r"^Lobby (column )?to courtyard ring", re.I)


def _norm(s: Optional[str]) -> str:
    cleaned = re.sub(r"[^a-z0-9 ]+", " ", (s or "").lower())
    return re.sub(r"\s+", " ", cleaned).strip()


def _levenshtein(a: str, b: str, max_dist: int) -> int:
    if abs(len(a) - len(b)) > max_dist:
        return max_dist + 1
    prev = list(range(len(b) + 1))
    for i in range(1, len(a) + 1):
        cur = [i]
        row_min = i
        for j in range(1, len(b) + 1):
            cost = 0 if a[i - 1] == b[j - 1] else 1
            val = min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost)
            cur.append(val)
            row_min = min(row_min, val)
        if row_min > max_dist:
            return max_dist + 1
        prev = cur
    return prev[len(b)]


def _lerp(a: List[float], b: List[float], t: float) -> List[float]:
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]


def _is_ramp_name(name: Optional[str]) -> bool:
    return bool(re.match(r"^(PWD|PCED) ramp", name or "", re.I))


def _crossing(
    a1: List[float], a2: List[float], b1: List[float], b2: List[float]
) -> Optional[Dict[str, Any]]:
    p = to_xy(a1)
    r = [v - p[i] for i, v in enumerate(to_xy(a2))]
    q = to_xy(b1)
    s = [v - q[i] for i, v in enumerate(to_xy(b2))]
    den = r[0] * s[1] - r[1] * s[0]
    if abs(den) < 1e-9:
        return None
    t = ((q[0] - p[0]) * s[1] - (q[1] - p[1]) * s[0]) / den
    u = ((q[0] - p[0]) * r[1] - (q[1] - p[1]) * r[0]) / den
    e = 0.02
    if t <= e or t >= 1.0 - e or u <= e or u >= 1.0 - e:
        return None
    return {
        "t": t,
        "u": u,
        "point": to_lng_lat([p[0] + t * r[0], p[1] + t * r[1]]),
    }


def _rise_line(
    struct: Dict[str, Any], kind: str, name: str, candidates: List[Dict[str, Any]]
) -> Dict[str, Any]:
    min_x, min_y, max_x, max_y = struct["bounds"]
    cx, cy = bounds_center(struct["bounds"])
    d = struct.get("direction")
    vertical = d in ("north", "south")
    low_at_min = d in ("north", "east")
    if vertical:
        edge = [
            [min_x, min_y if low_at_min else max_y],
            [max_x, min_y if low_at_min else max_y],
        ]
    else:
        edge = [
            [min_x if low_at_min else max_x, min_y],
            [min_x if low_at_min else max_x, max_y],
        ]

    best = None
    for l in candidates:
        if l.get("kind") == "door":
            continue
        for v in l["coords"]:
            r = project_on_line(v, edge)
            if r and r["distance"] <= 8.0 and (best is None or r["distance"] < best["score"]):
                best = {"score": r["distance"], "point": r["point"]}

    along = (
        (best["point"][0] if vertical else best["point"][1])
        if best
        else (cx if vertical else cy)
    )
    if vertical:
        a = [along, min_y if low_at_min else max_y]
        b = [along, max_y if low_at_min else min_y]
    else:
        a = [min_x if low_at_min else max_x, along]
        b = [max_x if low_at_min else min_x, along]

    return {
        "id": struct.get("id"),
        "name": name,
        "kind": kind,
        "zone": "entrance",
        "oneway": False,
        "building": struct.get("building"),
        "coords": [a, b],
        "snapTol": 8.0,
    }


def _planarize(lines: List[Dict[str, Any]]) -> Dict[str, Any]:
    items = []
    for l in lines:
        verts = [{"c": list(c), "node": False, "tag": None} for c in l["coords"]]
        if verts:
            verts[0]["node"] = True
            verts[-1]["node"] = True
            if l.get("tags", {}).get("start"):
                verts[0]["tag"] = l["tags"]["start"]
            if l.get("tags", {}).get("end"):
                verts[-1]["tag"] = l["tags"]["end"]
            if l.get("startTag"):
                verts[0]["tag"] = l["startTag"]
            for mark in l.get("marks") or []:
                for v in verts:
                    if v["c"] == mark["c"]:
                        v["node"] = True
                        v["tag"] = mark["tag"]
                        break
        items.append({**l, "verts": verts})

    inserts = []
    extensions = []

    # Mid-segment crossings
    for i in range(len(items)):
        for j in range(i + 1, len(items)):
            A = items[i]
            B = items[j]
            if A.get("kind") == "door" or B.get("kind") == "door":
                continue
            for k in range(len(A["coords"]) - 1):
                for m in range(len(B["coords"]) - 1):
                    hit = _crossing(
                        A["coords"][k],
                        A["coords"][k + 1],
                        B["coords"][m],
                        B["coords"][m + 1],
                    )
                    if not hit:
                        continue
                    inserts.append(
                        {
                            "B": A,
                            "ref": A["verts"][k],
                            "t": hit["t"],
                            "vert": {"c": hit["point"], "node": True, "tag": None},
                        }
                    )
                    inserts.append(
                        {
                            "B": B,
                            "ref": B["verts"][m],
                            "t": hit["u"],
                            "vert": {"c": hit["point"], "node": True, "tag": None},
                        }
                    )

    # T-junction dead-end snapping
    for A in items:
        for at_start in (True, False):
            e = A["verts"][0] if at_start else A["verts"][-1]
            special = (not A.get("snapStartOnly")) or at_start
            tol = (A.get("snapTol") if A.get("snapTol") is not None else SNAP_TOL_M) if special else SNAP_TOL_M
            flt = A.get("snapFilter") if special else None
            best = None
            for B in items:
                if B is A or B.get("kind") == "door" or (flt and not flt(B)):
                    continue
                r = project_on_line(e["c"], B["coords"])
                score = r["distance"] if r else float("inf")
                if r and r["distance"] <= tol and (best is None or score < best["score"]):
                    best = {"B": B, "r": r, "score": score}
            if not best:
                continue
            B = best["B"]
            r = best["r"]
            seg_idx = r["segmentIndex"]
            ref = next((v for v in B["verts"] if v["c"] == B["coords"][seg_idx]), None)
            ref_next = next((v for v in B["verts"] if v["c"] == B["coords"][seg_idx + 1]), None)
            snapped = next(
                (v for v in (ref, ref_next) if v and haversine(v["c"], r["point"]) <= NODE_TOL_M),
                None,
            )
            if snapped:
                snapped["node"] = True
                target = snapped
            else:
                target = {"c": r["point"], "node": True, "tag": None}
                if ref is not None:
                    inserts.append({"B": B, "ref": ref, "t": r["t"], "vert": target})
            if haversine(e["c"], target["c"]) > NODE_TOL_M:
                extensions.append({"A": A, "atStart": at_start, "vert": target})

    by_line: Dict[int, List[Dict[str, Any]]] = {}
    for ins in inserts:
        lid = id(ins["B"])
        by_line.setdefault(lid, []).append(ins)
    for lid, ins_list in by_line.items():
        ins_list.sort(key=lambda x: x["t"], reverse=True)
        B = ins_list[0]["B"]
        for item in ins_list:
            if item["ref"] in B["verts"]:
                idx = B["verts"].index(item["ref"])
                B["verts"].insert(idx + 1, item["vert"])

    for ext in extensions:
        copy_vert = {"c": list(ext["vert"]["c"]), "node": True, "tag": None}
        if ext["atStart"]:
            ext["A"]["verts"].insert(0, copy_vert)
        else:
            ext["A"]["verts"].append(copy_vert)

    node_verts = [v for l in items for v in l["verts"] if v["node"]]
    parent = list(range(len(node_verts)))

    def find(i: int) -> int:
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    def union(i: int, j: int):
        ri, rj = find(i), find(j)
        if ri != rj:
            parent[ri] = rj

    grid: Dict[str, List[int]] = {}
    for i, v in enumerate(node_verts):
        cx = int(round(v["c"][0] / 0.00001))
        cy = int(round(v["c"][1] / 0.00001))
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                for j in grid.get(f"{cx + dx}:{cy + dy}", []):
                    if haversine(node_verts[j]["c"], v["c"]) <= NODE_TOL_M:
                        union(i, j)
        key = f"{cx}:{cy}"
        grid.setdefault(key, []).append(i)

    named: Dict[str, int] = {}
    for i, v in enumerate(node_verts):
        tag = v.get("tag")
        if tag and tag.startswith("node:"):
            if tag in named:
                union(i, named[tag])
            else:
                named[tag] = i

    cluster_ids: Dict[int, int] = {}
    nodes: List[Dict[str, Any]] = []
    for i, v in enumerate(node_verts):
        root = find(i)
        if root not in cluster_ids:
            cluster_ids[root] = len(nodes)
            nodes.append({"coord": v["c"]})
        v["nodeIdx"] = cluster_ids[root]

    tag_node: Dict[str, int] = {}
    for v in node_verts:
        if v.get("tag") and v["tag"] not in tag_node:
            tag_node[v["tag"]] = v["nodeIdx"]

    edges: List[Dict[str, Any]] = []
    for l in items:
        start = 0
        for i in range(1, len(l["verts"])):
            if not l["verts"][i]["node"]:
                continue
            a = l["verts"][start]
            b = l["verts"][i]
            coords = [v["c"] for v in l["verts"][start : i + 1]]
            length = line_length(coords)
            if a["nodeIdx"] != b["nodeIdx"] or length > 0.5:
                edges.append(
                    {
                        "lineId": l.get("id"),
                        "name": l.get("name"),
                        "kind": l.get("kind", "walk"),
                        "zone": l.get("zone", "indoor"),
                        "oneway": bool(l.get("oneway", False)),
                        "building": l.get("building"),
                        "spur": bool(l.get("spur", False)),
                        "stairName": l.get("stairName"),
                        "a": a["nodeIdx"],
                        "b": b["nodeIdx"],
                        "coords": coords,
                        "len": length,
                    }
                )
            start = i

    return {"nodes": nodes, "edges": edges, "tagNode": tag_node}


def assign_room_ids(raw: Dict[str, Any]) -> Dict[int, str]:
    ids: Dict[int, str] = {}
    taken: Set[str] = set()
    for floor in FLOORS:
        rooms = (raw.get("floors", {}).get(floor, {}) or {}).get("rooms", {}) or {}
        for f in rooms.get("features", []):
            props = f.get("properties") or {}
            base = f"{props.get('code') or props.get('name') or 'room'}@F{floor}"
            room_id = base
            n = 2
            while room_id in taken:
                room_id = f"{base}#{n}"
                n += 1
            taken.add(room_id)
            ids[id(f)] = room_id
    return ids


def load_raw_geojson(data_dir: Path) -> Dict[str, Any]:
    """Reads all static GeoJSON files from the frontend public/data directory."""
    def read_json(rel_path: str) -> Optional[Dict[str, Any]]:
        full = data_dir / rel_path
        if not full.exists():
            return None
        with open(full, "r", encoding="utf-8") as fp:
            return json.load(fp)

    campus = read_json("macro/rtu_pasig_campus.geojson") or {"features": []}
    site = read_json("macro/site_features.geojson") or {"features": []}
    macro_paths = read_json("macro/paths.geojson") or {"features": []}

    floors: Dict[int, Dict[str, Any]] = {}
    for n in FLOORS:
        floors[n] = {
            "rooms": read_json(f"floor{n}/buildings_f{n}.geojson"),
            "paths": read_json(f"floor{n}/paths_f{n}.geojson"),
            "structures": read_json(f"floor{n}/structures_f{n}.json"),
        }
    return {"campus": campus, "site": site, "macroPaths": macro_paths, "floors": floors}


def build_graph_from_raw(raw: Dict[str, Any]) -> Dict[str, Any]:
    """Builds the planar multi-floor routing graph and location index from raw GeoJSON."""
    nodes: List[Dict[str, Any]] = []
    edges: List[Dict[str, Any]] = []
    tags: Dict[str, int] = {}
    room_ids = assign_room_ids(raw)

    def add_planar(floor: int, lines: List[Dict[str, Any]]):
        res = _planarize(lines)
        base_idx = len(nodes)
        for n in res["nodes"]:
            nodes.append({"id": len(nodes), "floor": floor, "coord": n["coord"]})
        for e in res["edges"]:
            edges.append(
                {
                    **e,
                    "id": len(edges),
                    "floor": floor,
                    "floorTo": floor,
                    "a": e["a"] + base_idx,
                    "b": e["b"] + base_idx,
                }
            )
        for tag, idx in res["tagNode"].items():
            if tag not in tags:
                tags[tag] = idx + base_idx

    macro_features = (raw.get("macroPaths") or {}).get("features", [])
    macro_lines = []
    for f in macro_features:
        p = f.get("properties") or {}
        t_dict = (
            {"start": f"node:{p['from']}", "end": f"node:{p['to']}"}
            if p.get("from")
            else {}
        )
        macro_lines.append(
            {
                "id": p.get("id"),
                "name": p.get("name"),
                "kind": "walk",
                "zone": "outdoor",
                "oneway": False,
                "coords": [[c[0], c[1]] for c in f["geometry"]["coordinates"]],
                "tags": t_dict,
            }
        )

    site_features = (raw.get("site") or {}).get("features", [])
    campus_features = (raw.get("campus") or {}).get("features", [])

    gate1_geom = next(
        (f["geometry"] for f in site_features if (f.get("properties") or {}).get("name") == "Gate 1"),
        None,
    )
    javier_geom = next(
        (f["geometry"] for f in campus_features if (f.get("properties") or {}).get("name") == JAVIER_BUILDING),
        None,
    )

    for floor in FLOORS:
        fd = (raw.get("floors") or {}).get(floor) or {}
        if not fd.get("paths") and floor != 1:
            continue

        own_lines = []
        for i, f in enumerate((fd.get("paths") or {}).get("features", [])):
            p = f.get("properties") or {}
            name = p.get("name") or f"Floor {floor} path"
            ramp = _is_ramp_name(name)
            is_conn = bool(re.match(r"^Connector", name, re.I))
            is_spur = bool(re.search(r"(Access|Entrance) — ", name))
            own_lines.append(
                {
                    "id": p.get("id") or f"f{floor}_path_{i}",
                    "name": name,
                    "kind": "ramp" if ramp else "walk",
                    "zone": "outdoor" if (floor == 1 and not re.search(r"corridor", name, re.I) and not ramp) else "indoor",
                    "oneway": False,
                    "building": p.get("building"),
                    "spur": is_spur,
                    "coords": [[c[0], c[1]] for c in f["geometry"]["coordinates"]],
                    "snapTol": 10.0 if (is_conn or is_spur) else None,
                    "snapFilter": (
                        (lambda t: t.get("kind") == "ramp" or bool(re.search(r"corridor", t.get("name") or "", re.I)))
                        if is_conn
                        else None
                    ),
                    "snapStartOnly": is_conn,
                }
            )

        # Drop redundant macro lines on floor 1
        combined = list(own_lines)
        if floor == 1:
            ground = [l for l in own_lines if l.get("kind") != "door"]
            for m in macro_lines:
                if re.match(r"^Gate \d", m.get("name") or "", re.I):
                    combined.append(m)
                    continue
                keep = False
                for idx_c in range(len(m["coords"]) - 1):
                    for k in range(9):
                        pt = _lerp(m["coords"][idx_c], m["coords"][idx_c + 1], k / 8.0)
                        if not any(
                            (project_on_line(pt, g["coords"]) or {"distance": 999})["distance"] <= MACRO_REDUNDANT_M
                            for g in ground
                        ):
                            keep = True
                            break
                    if keep:
                        break
                if keep:
                    combined.append(m)

        # Dedupe lines
        base: List[Dict[str, Any]] = []
        for l in combined:
            is_dup = False
            for k in base:
                if len(k["coords"]) == len(l["coords"]):
                    fwd = all(haversine(c, l["coords"][i]) < 0.5 for i, c in enumerate(k["coords"]))
                    rev = all(
                        haversine(c, l["coords"][len(l["coords"]) - 1 - i]) < 0.5
                        for i, c in enumerate(k["coords"])
                    )
                    if fwd or rev:
                        is_dup = True
                        break
            if not is_dup:
                base.append(l)

        # Apply Gate 1 lanes and Javier Lobby mark on floor 1
        if floor == 1:
            if gate1_geom:
                new_base = []
                for idx, l in enumerate(base):
                    rule = next((r for r in GATE1_LANES if r["re"].search(l.get("name") or "")), None)
                    if not rule:
                        new_base.append({**l, "oneway": False})
                        continue
                    parts = []
                    cur = [l["coords"][0]]
                    for i_c in range(1, len(l["coords"])):
                        p_pt = l["coords"][i_c - 1]
                        q_pt = l["coords"][i_c]
                        dp = distance_to_polygon(p_pt, gate1_geom)
                        dq = distance_to_polygon(q_pt, gate1_geom)
                        if (dp <= GATE1_LANE_M) != (dq <= GATE1_LANE_M):
                            cut = _lerp(p_pt, q_pt, (GATE1_LANE_M - dp) / (dq - dp))
                            cur.append(cut)
                            parts.append(cur)
                            cur = [cut]
                        cur.append(q_pt)
                    parts.append(cur)
                    for k_idx, coords_part in enumerate(parts):
                        ds = [distance_to_polygon(c, gate1_geom) for c in coords_part]
                        near = max(ds) <= GATE1_LANE_M + 0.01
                        part_id = f"{l['id']}_p{k_idx}" if len(parts) > 1 else l["id"]
                        if not near:
                            new_base.append({**l, "id": part_id, "coords": coords_part, "oneway": False})
                        else:
                            towards_gate = ds[0] > ds[-1]
                            want_towards = rule["flow"] == "in"
                            oriented = coords_part if (towards_gate == want_towards) else list(reversed(coords_part))
                            new_base.append({**l, "id": part_id, "coords": oriented, "oneway": True, "order": idx})
                base = new_base

            if javier_geom:
                for l in base:
                    if not LOBBY_LINE_RE.search(l.get("name") or ""):
                        continue
                    first_pt = None
                    last_pt = None
                    for i_c in range(len(l["coords"]) - 1):
                        a_pt = l["coords"][i_c]
                        b_pt = l["coords"][i_c + 1]
                        steps_n = max(1, int(round(haversine(a_pt, b_pt) / 0.25)))
                        for k_s in range(steps_n + 1):
                            pt = _lerp(a_pt, b_pt, k_s / float(steps_n))
                            if point_in_polygon(pt, javier_geom):
                                if first_pt is None:
                                    first_pt = pt
                                last_pt = pt
                    if first_pt and last_pt:
                        mid = _lerp(first_pt, last_pt, 0.5)
                        r = project_on_line(mid, l["coords"])
                        if r:
                            seg_i = r["segmentIndex"]
                            l["coords"] = [*l["coords"][: seg_i + 1], mid, *l["coords"][seg_i + 1 :]]
                            l["marks"] = [{"c": mid, "tag": JAVIER_LOBBY_TAG}]

        extra: List[Dict[str, Any]] = []
        structs = fd.get("structures") or []

        def nearest_on_lines(point: List[float], pool: List[Dict[str, Any]], flt: Optional[Callable] = None):
            best_hit = None
            for line_item in pool:
                if flt and not flt(line_item):
                    continue
                r = project_on_line(point, line_item["coords"])
                if r and (best_hit is None or r["distance"] < best_hit["score"]):
                    best_hit = {**r, "score": r["distance"]}
            return best_hit

        if floor == 1:
            for s in structs:
                if s.get("type") == "stairs" and s.get("layout") == "single":
                    extra.append(_rise_line(s, "entrance-stairs", s.get("full_name") or s.get("name"), base))
                elif s.get("type") == "ramp":
                    c = bounds_center(s["bounds"])
                    cov = nearest_on_lines(c, base, lambda l: l.get("kind") == "ramp")
                    if not cov or cov["distance"] > 6.0:
                        extra.append(_rise_line(s, "ramp", s.get("label") or s.get("name"), base))

        for s in structs:
            if not re.match(r"^stairs", s.get("type") or "") or s.get("layout") == "single":
                continue
            c = bounds_center(s["bounds"])
            hit = nearest_on_lines(c, [*base, *extra], lambda l: l.get("kind") != "entrance-stairs")
            if not hit or hit["distance"] > STAIR_ATTACH_MAX_M:
                continue
            extra.append(
                {
                    "id": f"landing_{s['id']}",
                    "name": s.get("name"),
                    "stairName": s.get("name"),
                    "kind": "landing",
                    "zone": "indoor",
                    "oneway": False,
                    "building": s.get("building"),
                    "coords": [c, hit["point"]],
                    "startTag": f"stair:{floor}:{s['id']}",
                    "snapTol": 0.5,
                }
            )

        for f in (fd.get("rooms") or {}).get("features", []):
            props = f.get("properties") or {}
            c = polygon_centroid(f["geometry"])
            same = [l for l in base if l.get("building") and l.get("building") == props.get("building")]
            pool = same if same else [l for l in base if l.get("zone") != "outdoor" or floor == 1]
            hit = nearest_on_lines(c, [*pool, *[l for l in extra if l.get("kind") == "ramp"]])
            if not hit or hit["distance"] > ROOM_ATTACH_MAX_M:
                continue
            rid = room_ids[id(f)]
            extra.append(
                {
                    "id": f"door_{rid}",
                    "name": props.get("name") or props.get("code"),
                    "kind": "door",
                    "zone": "indoor",
                    "oneway": False,
                    "building": props.get("building"),
                    "coords": [c, hit["point"]],
                    "startTag": f"room:{rid}",
                    "snapTol": 0.5,
                }
            )

        add_planar(floor, [*base, *extra])

    # Vertical stair links across consecutive floors
    for floor in FLOORS:
        lower = [
            s
            for s in ((raw.get("floors", {}).get(floor) or {}).get("structures") or [])
            if s.get("type") == "stairs" and s.get("layout") != "single"
        ]
        upper = [
            s
            for s in ((raw.get("floors", {}).get(floor + 1) or {}).get("structures") or [])
            if re.match(r"^stairs", s.get("type") or "") and s.get("layout") != "single"
        ]
        for s in lower:
            c = bounds_center(s["bounds"])
            best_u = None
            for u in upper:
                d = haversine(c, bounds_center(u["bounds"]))
                if d <= STAIR_MATCH_MAX_M and (best_u is None or d < best_u["d"]):
                    best_u = {"u": u, "d": d}
            if not best_u:
                continue
            a_idx = tags.get(f"stair:{floor}:{s['id']}")
            b_idx = tags.get(f"stair:{floor + 1}:{best_u['u']['id']}")
            if a_idx is None or b_idx is None:
                continue
            edges.append(
                {
                    "id": len(edges),
                    "lineId": f"stairs_{s['id']}_{best_u['u']['id']}",
                    "name": s.get("full_name") or s.get("name"),
                    "stairName": s.get("name"),
                    "kind": "stairs",
                    "zone": "indoor",
                    "oneway": False,
                    "building": s.get("building"),
                    "a": a_idx,
                    "b": b_idx,
                    "floor": floor,
                    "floorTo": floor + 1,
                    "coords": [nodes[a_idx]["coord"]],
                    "coordsTo": [nodes[b_idx]["coord"]],
                    "len": STAIRS_LENGTH_M,
                }
            )

    # Build searchable locations index matching locationService.js
    locations: List[Dict[str, Any]] = []

    def building_for(b_name: Optional[str], coord: List[float]) -> Optional[str]:
        if b_name and b_name in BUILDING_ALIASES:
            return BUILDING_ALIASES[b_name]
        hit = next(
            (
                f["properties"]["name"]
                for f in campus_features
                if f.get("properties", {}).get("category") == "building"
                and f.get("properties", {}).get("name") == b_name
            ),
            None,
        )
        if hit:
            return hit
        inside = next(
            (
                f["properties"]["name"]
                for f in campus_features
                if f.get("properties", {}).get("category") != "outdoor_structure"
                and point_in_polygon(coord, f.get("geometry"))
            ),
            None,
        )
        return inside or b_name or None

    for f in campus_features:
        p = f.get("properties") or {}
        locations.append(
            {
                "id": f"building:{p['name']}",
                "name": p.get("label") or p["name"],
                "fullName": p["name"],
                "type": "building",
                "building": p["name"],
                "floor": None,
                "floors": p.get("floors") or 0,
                "coordinates": polygon_centroid(f["geometry"]),
                "geometry": f["geometry"],
                "keywords": _norm(f"{p['name']} {p.get('label') or ''} {p.get('amenity') or ''} {p.get('category') or ''}"),
            }
        )

    for f in site_features:
        p = f.get("properties") or {}
        is_gate = p.get("category") == "gate"
        locations.append(
            {
                "id": f"{'gate' if is_gate else 'parking'}:{p['name']}",
                "name": p["name"],
                "fullName": p["name"],
                "type": "gate" if is_gate else "parking",
                "building": None,
                "floor": 1,
                "coordinates": polygon_centroid(f["geometry"]),
                "geometry": f["geometry"],
                "keywords": _norm(f"{p['name']} {'gate entrance exit' if is_gate else 'parking lot'}"),
            }
        )

    for floor in FLOORS:
        rooms = ((raw.get("floors") or {}).get(floor) or {}).get("rooms") or {}
        for f in rooms.get("features", []):
            p = f.get("properties") or {}
            coords = polygon_centroid(f["geometry"])
            rid = room_ids[id(f)]
            locations.append(
                {
                    "id": rid,
                    "name": p.get("name") or p.get("label") or p.get("code"),
                    "fullName": p.get("full_name") or p.get("description") or p.get("name"),
                    "type": "room",
                    "building": building_for(p.get("building"), coords),
                    "floor": floor,
                    "category": p.get("category"),
                    "code": p.get("code"),
                    "coordinates": coords,
                    "keywords": _norm(
                        f"{p.get('code') or ''} {p.get('label') or ''} {p.get('acronym') or ''} {p.get('category') or ''} {p.get('building') or ''}"
                    ),
                }
            )

    adj: List[List[Dict[str, Any]]] = [[] for _ in nodes]
    for e in edges:
        adj[e["a"]].append({"edge": e, "to": e["b"], "forward": True})
        if not e.get("oneway"):
            adj[e["b"]].append({"edge": e, "to": e["a"], "forward": False})

    return {
        "nodes": nodes,
        "edges": edges,
        "adj": adj,
        "tags": tags,
        "locations": locations,
        "campusFeatures": campus_features,
        "siteFeatures": site_features,
    }


class CampusGraphService:
    """Singleton-style routing and location service backed by Supabase + GeoJSON."""

    def __init__(self):
        self.nodes: List[Dict[str, Any]] = []
        self.edges: List[Dict[str, Any]] = []
        self.adj: List[List[Dict[str, Any]]] = []
        self.tags: Dict[str, int] = {}
        self.locations: List[Dict[str, Any]] = []
        self.locations_by_id: Dict[str, Dict[str, Any]] = {}
        self.campus_features: List[Dict[str, Any]] = []
        self.site_features: List[Dict[str, Any]] = []
        self.building_geometry: Dict[str, Dict[str, Any]] = {}
        self._loaded = False

    def _find_geojson_dir(self) -> Optional[Path]:
        env_dir = os.getenv("FRONTEND_DATA_DIR")
        workspace_root = Path(__file__).resolve().parent.parent.parent
        candidates = [
            Path(env_dir) if env_dir else None,
            workspace_root / "lookit-frontend" / "public" / "data",
            workspace_root / "public" / "data",
            Path(__file__).resolve().parent.parent / "data",
        ]
        for c in candidates:
            if c and (c / "macro" / "rtu_pasig_campus.geojson").exists():
                return c
        return None

    def _fetch_all_rows(self, table_name: str, page_size: int = 1000) -> List[Dict[str, Any]]:
        """Bypasses PostgREST 1000-row limit by paginating through the table."""
        all_rows = []
        offset = 0
        while True:
            res = supabase.table(table_name).select("*").range(offset, offset + page_size - 1).execute()
            data = res.data or []
            all_rows.extend(data)
            if len(data) < page_size:
                break
            offset += page_size
        return all_rows

    def reload_graph(self) -> Dict[str, Any]:
        """Loads graph & searchable locations from Supabase (or local GeoJSON if DB is empty)."""
        # Try loading from Supabase first using the pagination helper
        try:
            loc_rows = self._fetch_all_rows("location")
            edge_rows = self._fetch_all_rows("path_segments")
            bldg_rows = self._fetch_all_rows("buildings")
        except Exception as e:
            print(f"[Graph Service] Supabase load error: {e}")
            loc_rows, edge_rows, bldg_rows = [], [], []

        data_dir = self._find_geojson_dir()
        
        # Priority 1: Hydrate from Supabase if data exists
        if loc_rows and edge_rows:
            print(f"[Graph Service] Hydrating routing graph strictly from Supabase DB ({len(loc_rows)} locations, {len(edge_rows)} edges)...")
            self._hydrate_from_supabase(loc_rows, edge_rows, bldg_rows)
        # Priority 2: Fallback to GeoJSON files if DB is empty
        elif data_dir:
            print(f"[Graph Service] DB empty. Falling back to GeoJSON from {data_dir}...")
            raw = load_raw_geojson(data_dir)
            built = build_graph_from_raw(raw)
            self.nodes = built["nodes"]
            self.edges = built["edges"]
            self.adj = built["adj"]
            self.tags = built["tags"]
            self.locations = built["locations"]
            self.campus_features = built["campusFeatures"]
            self.site_features = built["siteFeatures"]

        self.locations_by_id = {str(loc["id"]): loc for loc in self.locations}
        self.building_geometry = {
            f["properties"]["name"]: f["geometry"]
            for f in self.campus_features
            if f.get("properties", {}).get("name") and f.get("geometry")
        }
        self._loaded = True
        return {
            "total_nodes": len(self.nodes),
            "total_edges": len(self.edges),
            "total_searchable_locations": len(self.locations),
        }

    def _hydrate_from_supabase(
        self,
        loc_rows: List[Dict[str, Any]],
        edge_rows: List[Dict[str, Any]],
        bldg_rows: List[Dict[str, Any]],
    ):
        """Rebuilds the in-memory planar graph and POI list strictly from Supabase tables."""
        self.nodes = []
        self.edges = []
        self.tags = {}
        self.locations = []
        self.campus_features = []
        self.site_features = []

        db_id_to_node_idx: Dict[int, int] = {}

        for b in bldg_rows:
            meta = b.get("metadata") or {}
            if meta.get("geometry"):
                self.campus_features.append(
                    {
                        "type": "Feature",
                        "properties": {
                            "name": b["name"],
                            "label": meta.get("label") or b["name"],
                            "category": meta.get("category") or "building",
                            "floors": meta.get("floors") or 0,
                        },
                        "geometry": meta["geometry"],
                    }
                )

        for r in sorted(loc_rows, key=lambda x: x["locationid"]):
            meta = r.get("metadata") or {}
            role = meta.get("role", "graph_node")
            coord = [float(r["x_coordinate"]), float(r["y_coordinate"])]
            floor_lvl = r.get("floor_level") or 1

            if role in ("graph_node", "both"):
                idx = len(self.nodes)
                self.nodes.append({"id": idx, "floor": floor_lvl, "coord": coord})
                db_id_to_node_idx[r["locationid"]] = idx
                for tag in meta.get("tags") or []:
                    if tag not in self.tags:
                        self.tags[tag] = idx

            if role in ("searchable_poi", "both"):
                poi = meta.get("poi") or {
                    "id": r.get("code") or str(r["locationid"]),
                    "name": r.get("label") or r["name"],
                    "fullName": r["name"],
                    "type": r["type"],
                    "building": r.get("building_code"),
                    "floor": floor_lvl,
                    "code": r.get("code"),
                    "coordinates": coord,
                    "geometry": meta.get("geometry"),
                    "keywords": meta.get("keywords") or _norm(f"{r['name']} {r.get('code') or ''}"),
                }
                self.locations.append(poi)
                if poi.get("type") in ("gate", "parking") and poi.get("geometry"):
                    self.site_features.append(
                        {
                            "type": "Feature",
                            "properties": {"name": poi["name"], "category": poi["type"]},
                            "geometry": poi["geometry"],
                        }
                    )

        for e in sorted(edge_rows, key=lambda x: x["pathid"]):
            a_idx = db_id_to_node_idx.get(e["start_location_id"])
            b_idx = db_id_to_node_idx.get(e["end_location_id"])
            if a_idx is None or b_idx is None:
                continue
            meta = e.get("metadata") or {}
            coords = e.get("coords") or [self.nodes[a_idx]["coord"], self.nodes[b_idx]["coord"]]
            self.edges.append(
                {
                    "id": len(self.edges),
                    "lineId": meta.get("lineId") or f"edge_{e['pathid']}",
                    "name": e.get("name") or "Path",
                    "stairName": meta.get("stairName"),
                    "kind": e.get("kind") or "walk",
                    "zone": e.get("zone") or "indoor",
                    "oneway": bool(e.get("oneway", False)),
                    "building": meta.get("building"),
                    "spur": bool(meta.get("spur", False)),
                    "a": a_idx,
                    "b": b_idx,
                    "floor": e.get("floor_from") or 1,
                    "floorTo": e.get("floor_to") or (e.get("floor_from") or 1),
                    "coords": coords,
                    "coordsTo": meta.get("coordsTo") or ([self.nodes[b_idx]["coord"]] if e.get("kind") == "stairs" else None),
                    "len": float(e.get("distance") or 0.0),
                }
            )

        self.adj = [[] for _ in self.nodes]
        for edge in self.edges:
            self.adj[edge["a"]].append({"edge": edge, "to": edge["b"], "forward": True})
            if not edge.get("oneway"):
                self.adj[edge["b"]].append({"edge": edge, "to": edge["a"], "forward": False})

    def ensure_loaded(self):
        if not self._loaded:
            self.reload_graph()

    # --- Search & Directory methods ---

    def _score_entry(self, loc: Dict[str, Any], q: str) -> int:
        fields = [_norm(loc.get("name")), _norm(loc.get("fullName")), _norm(loc.get("building"))]
        best = 0
        for f in fields:
            if not f:
                continue
            if f == q:
                best = max(best, 100)
            elif f.startswith(q):
                best = max(best, 80)
            elif any(w.startswith(q) for w in f.split(" ")):
                best = max(best, 65)
            elif q in f:
                best = max(best, 50)
        if not best and q in (loc.get("keywords") or ""):
            best = 40
        if not best and len(q) >= 4:
            max_d = 2 if len(q) >= 7 else 1
            words = [w for w in " ".join([*fields, loc.get("keywords") or ""]).split(" ") if w]
            if words:
                d = min(_levenshtein(q, w[: len(q) + 1], max_d) for w in words)
                if d <= max_d:
                    best = 30 - d * 5
        return best

    def search_locations(self, query: str = "", limit: int = 8) -> List[Dict[str, Any]]:
        self.ensure_loaded()
        q = _norm(query)
        if not q:
            return [l for l in self.locations if l.get("type") in ("building", "gate")][:5]
        scored = [
            (self._score_entry(loc, q), TYPE_RANK.get(loc.get("type", "room"), 2), loc.get("name", ""), loc)
            for loc in self.locations
        ]
        filtered = [item for item in scored if item[0] > 0]
        filtered.sort(key=lambda x: (-x[0], x[1], x[2]))
        return [item[3] for item in filtered[:limit]]

    def get_all_locations(self) -> List[Dict[str, Any]]:
        self.ensure_loaded()
        return self.locations

    def resolve_location_object(self, loc_or_query: Any) -> Optional[Dict[str, Any]]:
        self.ensure_loaded()
        if isinstance(loc_or_query, dict):
            loc_id = loc_or_query.get("id")
            if loc_id and loc_id in self.locations_by_id:
                return self.locations_by_id[loc_id]
            return loc_or_query
        if isinstance(loc_or_query, str):
            if loc_or_query in self.locations_by_id:
                return self.locations_by_id[loc_or_query]
            hits = self.search_locations(loc_or_query, limit=1)
            return hits[0] if hits else None
        return None

    # --- Dijkstra & Routing methods ---

    def _nodes_near_geometry(
        self, geometry: Dict[str, Any], floor: int = 1, slack: float = 6.0, max_nodes: int = 8
    ) -> List[int]:
        scored = [
            (distance_to_polygon(n["coord"], geometry), n["id"])
            for n in self.nodes
            if n["floor"] == floor
        ]
        scored.sort(key=lambda x: x[0])
        if not scored:
            return []
        min_d = scored[0][0]
        return [nid for d, nid in scored if d <= min_d + slack][:max_nodes]

    def _resolve_nodes(self, loc: Dict[str, Any]) -> Dict[str, Any]:
        if loc.get("type") == "room":
            own = self.tags.get(f"room:{loc.get('id')}")
            if own is not None:
                return {"ids": [own], "exact": True}
        if loc.get("geometry"):
            ids = self._nodes_near_geometry(loc["geometry"])
            if ids:
                return {"ids": ids, "exact": loc.get("type") != "room"}
        b_geom = self.building_geometry.get(loc.get("building") or "")
        ids = self._nodes_near_geometry(b_geom) if b_geom else []
        return {"ids": ids, "exact": False}

    def _edge_distance(self, edge: Dict[str, Any], mode: Dict[str, Any]) -> float:
        is_stairs = edge.get("kind") in ("stairs", "entrance-stairs")
        if is_stairs and mode.get("avoidStairs"):
            return float("inf")
        return STAIRS_LENGTH_M if edge.get("kind") == "stairs" else float(edge.get("len", 0.0))

    def _shortest_path(
        self, sources: List[int], targets: List[int], mode: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        dist: Dict[int, float] = {}
        prev: Dict[int, Dict[str, Any]] = {}
        heap: List[Tuple[float, int]] = []
        for s in sources:
            dist[s] = 0.0
            heapq.heappush(heap, (0.0, s))
        target_set = set(targets)
        found: Optional[int] = None

        while heap:
            d, u = heapq.heappop(heap)
            if d > dist.get(u, float("inf")):
                continue
            if u in target_set:
                found = u
                break
            for item in self.adj[u]:
                edge = item["edge"]
                to_node = item["to"]
                forward = item["forward"]
                w = self._edge_distance(edge, mode)
                if w == float("inf"):
                    continue
                nd = d + w
                if nd < dist.get(to_node, float("inf")):
                    dist[to_node] = nd
                    prev[to_node] = {"from": u, "edge": edge, "forward": forward}
                    heapq.heappush(heap, (nd, to_node))

        if found is None:
            return None

        steps = []
        node_ids = [found]
        cur = found
        while cur in prev:
            p = prev[cur]
            steps.append({"edge": p["edge"], "forward": p["forward"]})
            node_ids.append(p["from"])
            cur = p["from"]
        steps.reverse()
        node_ids.reverse()
        return {"nodeIds": node_ids, "steps": steps, "cost": dist[found], "target": found}

    def _shortest_path_via(
        self, sources: List[int], via: int, targets: List[int], mode: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        first = self._shortest_path(sources, [via], mode)
        if not first:
            return None
        second = self._shortest_path([via], targets, mode)
        if not second:
            return None
        return {
            "nodeIds": [*first["nodeIds"], *second["nodeIds"][1:]],
            "steps": [*first["steps"], *second["steps"]],
            "cost": first["cost"] + second["cost"],
            "target": second["target"],
            "via": via,
        }

    def _find_path(
        self,
        from_loc: Dict[str, Any],
        to_loc: Optional[Dict[str, Any]],
        emergency: bool,
        sources: List[int],
        targets: List[int],
        mode: Dict[str, Any],
    ) -> Optional[Dict[str, Any]]:
        lobby = self.tags.get(JAVIER_LOBBY_TAG)
        in_javier = lambda loc: bool(loc and loc.get("building") in JAVIER_AREA)
        if not emergency and lobby is not None and in_javier(from_loc) != in_javier(to_loc):
            return self._shortest_path_via(sources, lobby, targets, mode)
        return self._shortest_path(sources, targets, mode)

    def _building_at(self, coord: List[float]) -> Optional[str]:
        features = [
            f
            for f in self.campus_features
            if (f.get("properties") or {}).get("category") != "outdoor_structure"
        ]
        for f in features:
            if point_in_polygon(coord, f.get("geometry")):
                return f["properties"]["name"]
        best = None
        for f in features:
            d = haversine(coord, polygon_centroid(f["geometry"]))
            if d < 25.0 and (best is None or d < best["d"]):
                best = {"d": d, "name": f["properties"]["name"]}
        return best["name"] if best else None

    def _inside_building(self, coord: List[float]) -> bool:
        return any(
            (f.get("properties") or {}).get("category") != "outdoor_structure"
            and point_in_polygon(coord, f.get("geometry"))
            for f in self.campus_features
        )

    def compute_route(
        self, from_input: Any, to_input: Any, emergency: bool = False, pwd: bool = False
    ) -> Optional[Dict[str, Any]]:
        self.ensure_loaded()
        from_loc = self.resolve_location_object(from_input)
        to_loc = None if emergency else self.resolve_location_object(to_input)

        if not from_loc or (not emergency and not to_loc):
            return None

        src = self._resolve_nodes(from_loc)
        if not src["ids"]:
            return None

        warnings: List[str] = []
        if not src["exact"]:
            warnings.append(
                f"Indoor path to {from_loc.get('name')} is not mapped; the route starts at the {from_loc.get('building') or 'building'} entrance."
            )

        exits = []
        if emergency:
            for name in EMERGENCY_EXITS:
                f = next(
                    (x for x in self.site_features if (x.get("properties") or {}).get("name") == name),
                    None,
                )
                exits.append({"name": name, "ids": self._nodes_near_geometry(f["geometry"]) if f else []})
            targets = [nid for e in exits for nid in e["ids"]]
            if not targets:
                return None
        else:
            dst = self._resolve_nodes(to_loc)
            if not dst["ids"]:
                return None
            targets = dst["ids"]
            if not dst["exact"]:
                warnings.append(
                    f"Indoor path to {to_loc.get('name')} is not mapped; the route ends at the {to_loc.get('building') or 'building'} entrance."
                )

        mode = {"avoidStairs": pwd}
        path = self._find_path(from_loc, to_loc, emergency, src["ids"], targets, mode)
        if not path and pwd:
            mode = {"avoidStairs": False}
            path = self._find_path(from_loc, to_loc, emergency, src["ids"], targets, mode)
            if path:
                warnings.append(
                    "No step-free route exists in the campus data (no elevator or ramp between floors). This route uses stairs."
                )
        if not path:
            return None

        exit_name = (
            next((e["name"] for e in exits if path["target"] in e["ids"]), "the nearest exit")
            if emergency
            else None
        )
        to_label = f"{exit_name} (emergency exit)" if emergency else to_loc.get("name")
        if not emergency and to_loc.get("type") == "room":
            full_suffix = (
                f" – {to_loc['fullName']}"
                if to_loc.get("fullName") and to_loc["fullName"] != to_loc.get("name")
                else ""
            )
            dest = f"{to_loc.get('name')}{full_suffix} ({to_loc.get('building') or 'building'}, Floor {to_loc.get('floor')})"
        else:
            dest = to_label

        from_label = (
            f"{from_loc.get('name')} ({from_loc.get('building')}, Floor {from_loc.get('floor')})"
            if from_loc.get("type") == "room"
            else from_loc.get("name")
        )

        result = build_route_result(
            path,
            {
                "fromLabel": from_label,
                "toLabel": to_label,
                "arriveText": f"You have reached the emergency exit at {exit_name}"
                if emergency
                else f"You have arrived at {dest}",
                "mode": mode,
                "buildingAt": self._building_at,
                "insideBuilding": self._inside_building,
                "startCoord": self.nodes[path["nodeIds"][0]]["coord"],
                "startFloor": self.nodes[path["nodeIds"][0]]["floor"],
                "startZone": "indoor" if from_loc.get("type") == "room" else "outdoor",
                "endFloor": self.nodes[path["target"]]["floor"],
            },
        )

        if path.get("via") is not None:
            lobby_coord = self.nodes[path["via"]]["coord"]
            for st in result["steps"]:
                if any(haversine(c, lobby_coord) < 1.5 for c in (st.get("coords") or [])):
                    if "lobby" not in st["instruction"].lower():
                        st["instruction"] += " (through the Javier Building lobby)"
                    break

        named = {
            nid: tag[5:]
            for tag, nid in self.tags.items()
            if tag.startswith("node:")
        }

        return {
            **result,
            "nodes": [named[nid] for nid in path["nodeIds"] if nid in named],
            "warnings": warnings,
            "options": {"emergency": emergency, "pwd": pwd},
            "from": from_loc,
            "to": {**(to_loc or {}), "name": to_label, "type": "gate", "floor": 1}
            if emergency
            else to_loc,
        }


campus_graph_service = CampusGraphService()