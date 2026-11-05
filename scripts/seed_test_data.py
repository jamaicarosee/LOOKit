import sys
import os
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv(override=True)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SERVICE_KEY:
    raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in your .env file.")

admin_supabase: Client = create_client(SUPABASE_URL, SERVICE_KEY)

def seed():
    print("Cleaning up previous test data if present...")
    admin_supabase.table("buildings").delete().eq("code", "TB").execute()

    print("Seeding fresh mock data for RTU Pasig...")
    
    # 1. Building (PK: buildingid)
    b_res = admin_supabase.table("buildings").insert({"name": "Test Building", "code": "TB"}).select().execute()
    b_id = b_res.data[0]["buildingid"]
    print(f"Building created with ID: {b_id}")

    # 2. Floor (PK: floorid, FK: buildingid)
    f_res = admin_supabase.table("floors").insert({"buildingid": b_id, "floor_level": 1}).select().execute()
    f_id = f_res.data[0]["floorid"]
    print(f"Floor created with ID: {f_id}")

    # 3. Location table (Singular: 'location', PK: locationid, FK: floorid)
    locs = [
        {"floorid": f_id, "name": "Gate 1", "type": "entrance", "x_coordinate": 0.0, "y_coordinate": 0.0},
        {"floorid": f_id, "name": "Main Hallway", "type": "junction", "x_coordinate": 10.0, "y_coordinate": 0.0},
        {"floorid": f_id, "name": "Registrar Office", "type": "office", "x_coordinate": 20.0, "y_coordinate": 5.0},
    ]
    l_res = admin_supabase.table("location").insert(locs).select().execute()
    l_ids = [l["locationid"] for l in l_res.data]
    print(f"Locations created with IDs: {l_ids}")

    # 4. Path Segments (FKs: start_location_id, end_location_id)
    paths = [
        {"start_location_id": l_ids[0], "end_location_id": l_ids[1], "distance": 10.5, "is_accessible": True},
        {"start_location_id": l_ids[1], "end_location_id": l_ids[2], "distance": 12.0, "is_accessible": True},
    ]
    admin_supabase.table("path_segments").insert(paths).select().execute()
    print(f"\nSUCCESS! Seeded Node IDs: {l_ids}")

if __name__ == "__main__":
    seed()