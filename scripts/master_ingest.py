import os
import sys
import json
import math
from pathlib import Path
from dotenv import load_dotenv

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

load_dotenv(override=True)

try:
    from database import supabase
except ImportError:
    from supabase import create_client, Client
    SUPABASE_URL = os.getenv("SUPABASE_URL")
    SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")
    if not SUPABASE_URL or not SERVICE_KEY:
        raise ValueError("Missing Supabase credentials in .env file.")
    supabase = create_client(SUPABASE_URL, SERVICE_KEY)

# Direct map path verified on system
MAP_MODEL_DIR = Path("/home/friedtech/LOOKit/LOOKit-Map/LOOKit-Map")

METERS_PER_DEG_LAT = 110574.0
METERS_PER_DEG_LON = 107700.0

MAX_ROOM_SNAP_METERS = 30.0   # Doors to hallways
MAX_GATE_SNAP_METERS = 75.0   # Campus gates & parking to main paths
MIN_DOORWAY_METERS = 1.5
STAIR_FLIGHT_METERS = 8.0
BATCH_SIZE = 100
PAGINATION_LIMIT = 1000

BUILDING_NORMALIZER = {
    "CAS BUILDING": "CAS", "CAS": "CAS",
    "CED BUILDING": "CED", "CED": "CED",
    "JAVIER BUILDING": "JAV", "JAVIER": "JAV", "JAV": "JAV",
    "CANTEEN WING": "JAV", "CANTEEN": "JAV",
    "M.A.E BUILDING": "MAE", "M.A.E. BUILDING": "MAE", "M.A.E": "MAE", "MAE": "MAE",
    "SHARED FACILITY": "MAE",
}

def get_ground_distance(lon1: float, lat1: float, lon2: float, lat2: float) -> float:
    dx = (lon1 - lon2) * METERS_PER_DEG_LON
    dy = (lat1 - lat2) * METERS_PER_DEG_LAT
    return math.sqrt(dx * dx + dy * dy)

def extract_centroid(geom_or_item):
    if not geom_or_item:
        return None
    if isinstance(geom_or_item, dict):
        bounds = geom_or_item.get("bounds")
        if bounds and isinstance(bounds, list) and len(bounds) == 4:
            return (bounds[0] + bounds[2]) / 2.0, (bounds[1] + bounds[3]) / 2.0
        geom = geom_or_item.get("geometry", geom_or_item)
        gtype = geom.get("type", "")
        coords = geom.get("coordinates", [])
        if gtype == "Point" and len(coords) >= 2:
            return coords[0], coords[1]
        elif gtype in ["Polygon", "MultiPolygon"] and coords:
            ring = coords[0] if gtype == "Polygon" else coords[0][0]
            return sum(p[0] for p in ring) / len(ring), sum(p[1] for p in ring) / len(ring)
    return None

def fetch_all_rows(table_name: str, select_query: str = "*"):
    all_rows = []
    page = 0
    while True:
        res = (
            supabase.table(table_name)
            .select(select_query)
            .range(page * PAGINATION_LIMIT, (page + 1) * PAGINATION_LIMIT - 1)
            .execute()
        )
        batch = res.data or []
        all_rows.extend(batch)
        if len(batch) < PAGINATION_LIMIT:
            break
        page += 1
    return all_rows

def main():
    print("=== MASTER SPATIAL DATA INGESTION (UNIFIED GRAPH) ===")
    print(f"--> Using Vector Map Directory: {MAP_MODEL_DIR}")

    # Fetch floor records and mappings
    floors_res = supabase.table("floors").select("floorid, floor_level, buildings(code)").execute()
    floor_rows = floors_res.data or []
    if not floor_rows:
        raise ValueError("The 'floors' table is empty.")

    floor_lookup = {
        (f["buildings"]["code"], f["floor_level"]): f["floorid"]
        for f in floor_rows if f.get("buildings") and f.get("floor_level") is not None
    }
    floor_level_map = {f["floorid"]: f["floor_level"] for f in floor_rows}
    default_ground_fid = floor_lookup.get(("MAE", 1)) or floor_rows[0]["floorid"]

    seen_codes = {}
    def disambiguate_code(base_code: str) -> str:
        clean = str(base_code).strip()
        if clean in seen_codes:
            seen_codes[clean] += 1
            return f"{clean}-{seen_codes[clean]}"
        seen_codes[clean] = 1
        return clean

    # ---------------------------------------------------------
    # STAGE 1: Ingest Corridor Paths & Hallway Junctions
    # ---------------------------------------------------------
    print("\n--- [1/5] Ingesting Corridor Junctions & Paths (Floors 1 - 6) ---")
    path_sources = []
    main_paths = MAP_MODEL_DIR / "assets" / "data" / "paths.geojson"
    if main_paths.exists():
        path_sources.append((main_paths, 1))

    for f in range(1, 7):
        fpath = MAP_MODEL_DIR / f"src_floor{f}" / "data" / f"paths_f{f}.geojson"
        if fpath.exists():
            path_sources.append((fpath, f))

    coord_to_node_code = {}
    junction_records = []
    raw_segments = []

    for file_path, fallback_floor in path_sources:
        with open(file_path, "r", encoding="utf-8") as fp:
            data = json.load(fp)

        for feature in data.get("features", []):
            geom = feature.get("geometry", {})
            props = feature.get("properties", {})
            floor_num = props.get("floor_id") or props.get("floor") or fallback_floor or 1
            try:
                floor_num = int(floor_num)
            except (ValueError, TypeError):
                floor_num = 1

            fid = floor_lookup.get(("MAE", floor_num)) or default_ground_fid

            if geom.get("type") == "LineString":
                coords = geom.get("coordinates", [])
                for i in range(len(coords) - 1):
                    p1, p2 = coords[i], coords[i + 1]
                    k1 = (round(p1[0], 7), round(p1[1], 7), floor_num)
                    k2 = (round(p2[0], 7), round(p2[1], 7), floor_num)

                    for k, pt in [(k1, p1), (k2, p2)]:
                        if k not in coord_to_node_code:
                            node_code = disambiguate_code(f"NODE-F{floor_num}-{len(coord_to_node_code) + 1}")
                            coord_to_node_code[k] = node_code
                            junction_records.append({
                                "floorid": fid,
                                "code": node_code,
                                "name": f"Hallway Junction F{floor_num}",
                                "label": f"Junction F{floor_num}",
                                "type": "junction",
                                "building_code": "CAMPUS",
                                "x_coordinate": pt[0],
                                "y_coordinate": pt[1]
                            })
                    raw_segments.append((k1, k2, p1, p2))

    print(f"Upserting {len(junction_records)} junction nodes...")
    for i in range(0, len(junction_records), BATCH_SIZE):
        supabase.table("location").upsert(junction_records[i:i + BATCH_SIZE], on_conflict="code").execute()

    locs = fetch_all_rows("location", "locationid, code, type")
    code_to_id = {row["code"]: row["locationid"] for row in locs if row.get("type") == "junction"}

    path_edges = []
    seen_edges = set()
    for k1, k2, p1, p2 in raw_segments:
        id1 = code_to_id.get(coord_to_node_code.get(k1))
        id2 = code_to_id.get(coord_to_node_code.get(k2))

        if id1 and id2 and id1 != id2:
            if (id1, id2) not in seen_edges:
                dist = max(get_ground_distance(p1[0], p1[1], p2[0], p2[1]), 1.0)
                path_edges.append({"start_location_id": id1, "end_location_id": id2, "distance": round(dist, 2), "is_accessible": True})
                path_edges.append({"start_location_id": id2, "end_location_id": id1, "distance": round(dist, 2), "is_accessible": True})
                seen_edges.add((id1, id2))
                seen_edges.add((id2, id1))

    print(f"Writing {len(path_edges)} hallway path segments...")
    for i in range(0, len(path_edges), BATCH_SIZE):
        supabase.table("path_segments").insert(path_edges[i:i + BATCH_SIZE]).execute()

    # ---------------------------------------------------------
    # STAGE 2: Ingest Site Features (Gates & Parking)
    # ---------------------------------------------------------
    print("\n--- [2/5] Ingesting Site Features (Gates & Parking) ---")
    site_file = MAP_MODEL_DIR / "assets" / "data" / "site_features.geojson"
    if site_file.exists():
        with open(site_file, "r", encoding="utf-8") as fp:
            site_data = json.load(fp)

        site_records = []
        for feat in site_data.get("features", []):
            props = feat.get("properties", {})
            centroid = extract_centroid(feat)
            if not centroid:
                continue

            raw_name = props.get("name") or props.get("label") or "Site Feature"
            category = props.get("category") or props.get("role") or "facility"
            base_code = raw_name.upper().replace(" ", "-")

            site_records.append({
                "floorid": default_ground_fid,
                "code": disambiguate_code(base_code),
                "name": f"{raw_name} ({props.get('role', category)})",
                "label": props.get("label") or raw_name,
                "type": category.lower(),
                "building_code": "CAMPUS",
                "x_coordinate": round(centroid[0], 8),
                "y_coordinate": round(centroid[1], 8)
            })

        if site_records:
            supabase.table("location").upsert(site_records, on_conflict="code").execute()
            print(f"Upserted {len(site_records)} site features.")

    # ---------------------------------------------------------
    # STAGE 3: Ingest Rooms & POIs (buildings_f1..f6.geojson)
    # ---------------------------------------------------------
    print("\n--- [3/5] Ingesting Rooms & Classrooms (Floors 1 - 6) ---")
    for floor_num in range(1, 7):
        b_file = MAP_MODEL_DIR / f"src_floor{floor_num}" / "data" / f"buildings_f{floor_num}.geojson"
        if not b_file.exists():
            continue

        with open(b_file, "r", encoding="utf-8") as fp:
            b_data = json.load(fp)

        room_records = []
        for feat in b_data.get("features", []):
            props = feat.get("properties", {})
            centroid = extract_centroid(feat)
            if not centroid:
                continue

            raw_b = str(props.get("building", "")).strip().upper()
            b_code = BUILDING_NORMALIZER.get(raw_b, "MAE")
            fid = floor_lookup.get((b_code, floor_num)) or floor_lookup.get(("MAE", floor_num)) or default_ground_fid

            base_code = props.get("code") or f"F{floor_num}-{props.get('label') or 'ROOM'}"
            final_code = disambiguate_code(base_code)
            raw_name = props.get("full_name") or props.get("name") or props.get("label") or final_code
            raw_label = props.get("label") or raw_name

            raw_type = props.get("type", "room").lower()
            if "CR" in str(final_code).upper():
                raw_type = "restroom"
            elif "stair" in str(final_code).lower() or "stair" in str(raw_name).lower():
                raw_type = "stairs"

            room_records.append({
                "floorid": fid,
                "code": final_code,
                "name": raw_name,
                "label": raw_label,
                "type": raw_type,
                "building_code": b_code,
                "x_coordinate": round(centroid[0], 8),
                "y_coordinate": round(centroid[1], 8)
            })

        if room_records:
            for i in range(0, len(room_records), BATCH_SIZE):
                supabase.table("location").upsert(room_records[i:i + BATCH_SIZE], on_conflict="code").execute()
            print(f"Floor {floor_num}: Upserted {len(room_records)} rooms.")

    # ---------------------------------------------------------
    # STAGE 4: Ingest Stairs & Structures (structures_f1..f6.json)
    # ---------------------------------------------------------
    print("\n--- [4/5] Ingesting Stairs & Structures (Floors 1 - 6) ---")
    for floor_num in range(1, 7):
        s_file = MAP_MODEL_DIR / f"src_floor{floor_num}" / "data" / f"structures_f{floor_num}.json"
        if not s_file.exists():
            continue

        with open(s_file, "r", encoding="utf-8") as fp:
            s_data = json.load(fp)

        items = s_data if isinstance(s_data, list) else s_data.get("features", [])
        struct_records = []

        for item in items:
            props = item.get("properties", item)
            centroid = extract_centroid(item)
            if not centroid:
                continue

            raw_b = str(item.get("building") or props.get("building", "")).strip().upper()
            b_code = BUILDING_NORMALIZER.get(raw_b, "MAE")

            level = item.get("floor_level") or props.get("floor_level") or floor_num
            try:
                level = int(level)
            except (ValueError, TypeError):
                level = floor_num

            fid = floor_lookup.get((b_code, level)) or floor_lookup.get(("MAE", level)) or default_ground_fid

            raw_id = item.get("id") or props.get("id") or props.get("code") or f"STRUCT-F{level}"
            base_code = f"TRANSIT-{b_code}-{raw_id}-F{level}"
            final_code = disambiguate_code(base_code)

            name = item.get("full_name") or item.get("name") or props.get("name") or final_code
            label = item.get("name") or props.get("label") or name

            struct_records.append({
                "floorid": fid,
                "code": final_code,
                "name": name,
                "label": label,
                "type": "stairs",
                "building_code": b_code,
                "x_coordinate": round(centroid[0], 8),
                "y_coordinate": round(centroid[1], 8)
            })

        if struct_records:
            for i in range(0, len(struct_records), BATCH_SIZE):
                supabase.table("location").upsert(struct_records[i:i + BATCH_SIZE], on_conflict="code").execute()
            print(f"Floor {floor_num}: Upserted {len(struct_records)} stair/structure nodes.")

    # ---------------------------------------------------------
    # STAGE 5: Vertical Stitching & Global Snapping
    # ---------------------------------------------------------
    print("\n--- [5/5] Connecting Multi-Floor Stairs & Snapping Room Doorways ---")

    all_locations = fetch_all_rows("location", "locationid, code, name, type, floorid, x_coordinate, y_coordinate")
    print(f"Loaded {len(all_locations)} total locations.")

    # Read existing edges
    edge_rows = fetch_all_rows("path_segments", "start_location_id, end_location_id")
    existing_edges = set((r["start_location_id"], r["end_location_id"]) for r in edge_rows)

    # Attach actual integer floor_level to each location
    for loc in all_locations:
        loc["floor_level"] = floor_level_map.get(loc.get("floorid"), 1)

    # A. Vertical Stair Stitching (adjacent floors f <-> f+1, is_accessible = False)
    stair_nodes = [
        loc for loc in all_locations
        if loc.get("type") in ["stairs", "transit"] or "stair" in str(loc.get("name", "")).lower()
    ]
    vertical_edges = []

    for i, s1 in enumerate(stair_nodes):
        lvl1 = s1["floor_level"]
        for s2 in stair_nodes[i + 1:]:
            lvl2 = s2["floor_level"]
            if abs(lvl1 - lvl2) == 1:
                dist = get_ground_distance(s1["x_coordinate"], s1["y_coordinate"], s2["x_coordinate"], s2["y_coordinate"])
                if dist <= 5.0:  # Same vertical shaft column
                    u, v = s1["locationid"], s2["locationid"]
                    if (u, v) not in existing_edges:
                        vertical_edges.append({"start_location_id": u, "end_location_id": v, "distance": STAIR_FLIGHT_METERS, "is_accessible": False})
                        vertical_edges.append({"start_location_id": v, "end_location_id": u, "distance": STAIR_FLIGHT_METERS, "is_accessible": False})
                        existing_edges.add((u, v))
                        existing_edges.add((v, u))

    print(f"Generated {len(vertical_edges)} vertical stair edges between adjacent floors.")
    for i in range(0, len(vertical_edges), BATCH_SIZE):
        supabase.table("path_segments").insert(vertical_edges[i:i + BATCH_SIZE]).execute()

    # B. Doorway & POI Snapping to Corridor Junctions (Grouped strictly by floor_level)
    junctions_by_level = {}
    destinations = []

    for loc in all_locations:
        lvl = loc["floor_level"]
        if loc.get("type") == "junction":
            junctions_by_level.setdefault(lvl, []).append(loc)
        else:
            destinations.append(loc)

    doorway_edges = []
    for item in destinations:
        lvl = item["floor_level"]
        item_id = item["locationid"]
        level_junctions = junctions_by_level.get(lvl, [])
        if not level_junctions:
            # Fallback to Floor 1 if ground feature
            level_junctions = junctions_by_level.get(1, [])
            if not level_junctions:
                continue

        # Choose max snapping threshold based on type (gates need wider radius)
        ltype = (item.get("type") or "").lower()
        threshold = MAX_GATE_SNAP_METERS if ltype in ["gate", "parking", "facility"] else MAX_ROOM_SNAP_METERS

        closest_junc = min(
            level_junctions,
            key=lambda j: get_ground_distance(item["x_coordinate"], item["y_coordinate"], j["x_coordinate"], j["y_coordinate"])
        )
        dist = get_ground_distance(item["x_coordinate"], item["y_coordinate"], closest_junc["x_coordinate"], closest_junc["y_coordinate"])

        # Snap if within threshold OR force snap if stair landing
        if dist <= threshold or ltype in ["stairs", "transit"]:
            junc_id = closest_junc["locationid"]
            doorway_weight = round(max(dist, MIN_DOORWAY_METERS), 2)
            is_acc = (ltype not in ["stairs", "transit"])

            if (item_id, junc_id) not in existing_edges:
                doorway_edges.append({"start_location_id": item_id, "end_location_id": junc_id, "distance": doorway_weight, "is_accessible": is_acc})
                doorway_edges.append({"start_location_id": junc_id, "end_location_id": item_id, "distance": doorway_weight, "is_accessible": is_acc})
                existing_edges.add((item_id, junc_id))
                existing_edges.add((junc_id, item_id))

    print(f"Generated {len(doorway_edges)} doorway connector edges.")
    for i in range(0, len(doorway_edges), BATCH_SIZE):
        supabase.table("path_segments").insert(doorway_edges[i:i + BATCH_SIZE]).execute()

    print("\n=== MASTER INGESTION AND SNAPPING COMPLETED SUCCESSFULLY ===")

if __name__ == "__main__":
    main()