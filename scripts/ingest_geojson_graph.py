import os
import sys
import json
import math
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv(override=True)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")

if not SUPABASE_URL or not SERVICE_KEY:
    raise ValueError("Missing Supabase credentials in .env")

supabase: Client = create_client(SUPABASE_URL, SERVICE_KEY)

# Direct path to your verified directory
MAP_MODEL_DIR = Path(__file__).resolve().parent.parent.parent / "LOOKit_Map" / "LOOKit-Map"

# Normalization mapping based on the exact GeoJSON strings found
BUILDING_NORMALIZER = {
    "CAS BUILDING": "CAS",
    "CAS": "CAS",
    "CED BUILDING": "CED",
    "CED": "CED",
    "JAVIER BUILDING": "JAV",
    "JAVIER": "JAV",
    "JAV": "JAV",
    "CANTEEN WING": "JAV",
    "CANTEEN": "JAV",
    "M.A.E BUILDING": "MAE",
    "M.A.E. BUILDING": "MAE",
    "M.A.E": "MAE",
    "MAE": "MAE",
    "SHARED FACILITY": "MAE",
}

def haversine_distance(coord1: list[float], coord2: list[float]) -> float:
    """Calculates ground distance in meters between two [lon, lat] points."""
    lon1, lat1 = coord1
    lon2, lat2 = coord2
    R = 6371000.0  # Earth radius in meters

    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = math.sin(delta_phi / 2.0) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return round(R * c, 2)

def ingest():
    print(f"Scanning vector directory: {MAP_MODEL_DIR}")
    if not MAP_MODEL_DIR.exists():
        print(f"ERROR: Could not find directory at {MAP_MODEL_DIR}")
        return

    # 1. Fetch floor mapping from Supabase
    floors_res = supabase.table("floors").select("floorid, floor_level, buildings(code)").execute()
    floor_lookup = {
        (f["buildings"]["code"], f["floor_level"]): f["floorid"]
        for f in floors_res.data
    }

    # 2. Ingest Floor by Floor (Floors 1 to 6)
    for floor_num in range(1, 7):
        floor_folder = MAP_MODEL_DIR / f"src_floor{floor_num}" / "data"
        if not floor_folder.exists():
            print(f"Skipping Floor {floor_num}: data folder not found ({floor_folder})")
            continue

        print(f"\n--- Processing Floor {floor_num} ---")

        # A. Ingest Room Destinations (buildings_f[x].geojson)
        # A. Ingest Room Destinations (buildings_f[x].geojson)
        b_file = floor_folder / f"buildings_f{floor_num}.geojson"
        if b_file.exists():
            with open(b_file, "r", encoding="utf-8") as f:
                b_data = json.load(f)

            room_records = []
            seen_codes = {}  # Tracks counts to prevent duplicate 'code' errors

            for feat in b_data.get("features", []):
                props = feat.get("properties", {})
                geom = feat.get("geometry", {})

                # Map the full GeoJSON string to canonical code
                raw_b = str(props.get("building", "")).strip().upper()
                b_code = BUILDING_NORMALIZER.get(raw_b, "MAE")

                coords = geom.get("coordinates", [])
                if geom.get("type") == "Polygon" and coords:
                    ring = coords[0]
                    avg_lon = sum(p[0] for p in ring) / len(ring)
                    avg_lat = sum(p[1] for p in ring) / len(ring)
                elif geom.get("type") == "MultiPolygon" and coords:
                    ring = coords[0][0]
                    avg_lon = sum(p[0] for p in ring) / len(ring)
                    avg_lat = sum(p[1] for p in ring) / len(ring)
                else:
                    continue

                fid = floor_lookup.get((b_code, floor_num))
                if not fid:
                    fid = floor_lookup.get(("MAE", floor_num))

                # Disambiguate duplicate codes (e.g. two FACULTY CRs or split rooms)
                base_code = props.get("code") or f"F{floor_num}-{props.get('label') or 'ROOM'}"
                if base_code in seen_codes:
                    seen_codes[base_code] += 1
                    code_val = f"{base_code}-{seen_codes[base_code]}"
                else:
                    seen_codes[base_code] = 1
                    code_val = base_code

                room_records.append({
                    "floorid": fid,
                    "code": code_val,
                    "name": props.get("full_name") or props.get("name") or props.get("label"),
                    "label": props.get("label"),
                    "type": "restroom" if "CR" in str(code_val).upper() else "room",
                    "building_code": b_code,
                    "x_coordinate": round(avg_lon, 8),
                    "y_coordinate": round(avg_lat, 8)
                })

            if room_records:
                supabase.table("location").upsert(room_records, on_conflict="code").execute()
                print(f"Upserted {len(room_records)} destination rooms on Floor {floor_num}.")

        # B. Ingest Hallway Navigation Graph (paths_f[x].geojson)
        p_file = floor_folder / f"paths_f{floor_num}.geojson"
        if p_file.exists():
            with open(p_file, "r", encoding="utf-8") as f:
                p_data = json.load(f)

            coord_to_node_id = {}
            junction_records = []
            edges_to_insert = []

            default_fid = floor_lookup.get(("MAE", floor_num)) or list(floor_lookup.values())[0]

            for feat in p_data.get("features", []):
                coords = feat.get("geometry", {}).get("coordinates", [])
                for pt in coords:
                    pt_key = (round(pt[0], 7), round(pt[1], 7))
                    if pt_key not in coord_to_node_id:
                        node_code = f"NODE-F{floor_num}-{len(coord_to_node_id) + 1}"
                        coord_to_node_id[pt_key] = node_code
                        junction_records.append({
                            "floorid": default_fid,
                            "code": node_code,
                            "name": f"Hallway Junction F{floor_num}",
                            "type": "junction",
                            "building_code": "CAMPUS",
                            "x_coordinate": pt[0],
                            "y_coordinate": pt[1]
                        })

            if junction_records:
                supabase.table("location").upsert(junction_records, on_conflict="code").execute()

            # Retrieve database IDs for inserted junction nodes
            locs_res = supabase.table("location").select("locationid, code").execute()
            code_id_map = {l["code"]: l["locationid"] for l in locs_res.data}

            for feat in p_data.get("features", []):
                coords = feat.get("geometry", {}).get("coordinates", [])
                for i in range(len(coords) - 1):
                    p1 = (round(coords[i][0], 7), round(coords[i][1], 7))
                    p2 = (round(coords[i + 1][0], 7), round(coords[i + 1][1], 7))

                    id1 = code_id_map.get(coord_to_node_id.get(p1))
                    id2 = code_id_map.get(coord_to_node_id.get(p2))

                    if id1 and id2 and id1 != id2:
                        dist = haversine_distance(coords[i], coords[i + 1])
                        edges_to_insert.append({
                            "start_location_id": id1,
                            "end_location_id": id2,
                            "distance": max(dist, 1.0),
                            "is_accessible": True
                        })

            if edges_to_insert:
                supabase.table("path_segments").insert(edges_to_insert).execute()
                print(f"Inserted {len(edges_to_insert)} path segment edges on Floor {floor_num}.")

    print("\nVector ingestion completed successfully.")

if __name__ == "__main__":
    ingest()