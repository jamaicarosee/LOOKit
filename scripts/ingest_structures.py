import os
import json
import re
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv(override=True)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")

if not SUPABASE_URL or not SERVICE_KEY:
    raise ValueError("Missing Supabase credentials in .env")

supabase: Client = create_client(SUPABASE_URL, SERVICE_KEY)

MAP_MODEL_DIR = Path(__file__).resolve().parent.parent.parent / "LOOKit_Map" / "LOOKit-Map"

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

def snap_to_hallways():
    print("\n=== Snapping Transit Landings to Floor Walkways ===")

    # 1. Fetch all transit nodes
    transit_res = supabase.table("location").select(
        "locationid, code, floorid, x_coordinate, y_coordinate"
    ).like("code", "TRANSIT-%").execute()
    transit_nodes = transit_res.data

    # 2. Fetch all hallway junction nodes
    junction_res = supabase.table("location").select(
        "locationid, code, floorid, x_coordinate, y_coordinate"
    ).eq("type", "junction").execute()
    junction_nodes = junction_res.data

    print(f"Loaded {len(transit_nodes)} transit landings and {len(junction_nodes)} corridor junctions.")

    # Group junctions by floorid for fast local lookup
    junctions_by_floor = {}
    for j in junction_nodes:
        junctions_by_floor.setdefault(j["floorid"], []).append(j)

    horizontal_edges = []
    
    # 3. For each transit landing, find nearest junction on the exact same floor
    for st in transit_nodes:
        fid = st["floorid"]
        floor_junctions = junctions_by_floor.get(fid, [])
        if not floor_junctions:
            continue

        # Find closest corridor node via squared Euclidean distance
        closest_j = min(
            floor_junctions,
            key=lambda j: (j["x_coordinate"] - st["x_coordinate"]) ** 2 + 
                          (j["y_coordinate"] - st["y_coordinate"]) ** 2
        )

        # Connect bidirectionally (Stairs <-> Hallway)
        horizontal_edges.append({
            "start_location_id": st["locationid"],
            "end_location_id": closest_j["locationid"],
            "distance": 2.0,  # 2-meter step into the stairwell / ramp
            "is_accessible": True
        })
        horizontal_edges.append({
            "start_location_id": closest_j["locationid"],
            "end_location_id": st["locationid"],
            "distance": 2.0,
            "is_accessible": True
        })

    if horizontal_edges:
        supabase.table("path_segments").insert(horizontal_edges).execute()
        print(f"Inserted {len(horizontal_edges)} horizontal hallway-to-transit connections!")
    else:
        print("No hallway connections formed.")

if __name__ == "__main__":
    snap_to_hallways()