import os
import sys
import math
from pathlib import Path

# Ensures backend root is always on sys.path regardless of execution folder
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from database import supabase

# Planar ground distance conversion factors for Pasig (~14.57° N)
METERS_PER_DEG_LAT = 110574.0
METERS_PER_DEG_LON = 107700.0

MAX_SNAPPING_METERS = 30.0   # Doorway distance threshold
MIN_DOORWAY_METERS = 1.5     # Baseline physical cost for crossing a doorway threshold
BATCH_SIZE = 100
PAGINATION_LIMIT = 1000

def get_ground_distance(lon1: float, lat1: float, lon2: float, lat2: float) -> float:
    """Calculates ground distance in meters using planar approximation."""
    dx = (lon1 - lon2) * METERS_PER_DEG_LON
    dy = (lat1 - lat2) * METERS_PER_DEG_LAT
    return math.sqrt(dx * dx + dy * dy)

def main():
    print("=== STARTING ROOM DOORWAY SNAPPING ===")

    # 1. Fetch floor mapping (floorid -> floor_level)
    floors_res = supabase.table("floors").select("floorid, floor_level").execute()
    floors_data = floors_res.data or []
    floor_level_map = {f["floorid"]: f.get("floor_level") for f in floors_data}
    print(f"Loaded {len(floor_level_map)} floor mappings from database.")

    # 2. Fetch all locations with pagination
    all_locations = []
    page = 0
    while True:
        loc_res = (
            supabase.table("location")
            .select("locationid, code, name, type, floorid, x_coordinate, y_coordinate")
            .range(page * PAGINATION_LIMIT, (page + 1) * PAGINATION_LIMIT - 1)
            .execute()
        )
        batch = loc_res.data or []
        all_locations.extend(batch)
        if len(batch) < PAGINATION_LIMIT:
            break
        page += 1

    print(f"Loaded {len(all_locations)} total locations.")

    # 3. Categorize into Junctions and Room Destinations
    junctions_by_level = {}
    destinations = []
    excluded_types = {"junction", "stairs", "ramp", "transit"}

    for loc in all_locations:
        floor_id = loc.get("floorid")
        level = floor_level_map.get(floor_id)
        loc["floor_level"] = level

        x_coord = loc.get("x_coordinate")
        y_coord = loc.get("y_coordinate")

        # Skip entries lacking coordinates or mapped floor levels
        if x_coord is None or y_coord is None or level is None:
            continue

        ltype = (loc.get("type") or "").strip().lower()

        if ltype == "junction":
            junctions_by_level.setdefault(level, []).append(loc)
        elif ltype not in excluded_types:
            destinations.append(loc)

    print(f"Identified {len(destinations)} destination rooms and {sum(len(v) for v in junctions_by_level.values())} corridor junctions.")

    # 4. Fetch existing edges from path_segments to prevent duplicates
    existing_edges = set()
    page = 0
    while True:
        seg_res = (
            supabase.table("path_segments")
            .select("start_location_id, end_location_id")
            .range(page * PAGINATION_LIMIT, (page + 1) * PAGINATION_LIMIT - 1)
            .execute()
        )
        rows = seg_res.data or []
        for r in rows:
            existing_edges.add((r["start_location_id"], r["end_location_id"]))
        if len(rows) < PAGINATION_LIMIT:
            break
        page += 1

    print(f"Loaded {len(existing_edges)} existing directional edges from path_segments.")

    # 5. Calculate nearest same-floor junction for every room
    new_segments = []
    unconnected_rooms = []

    for room in destinations:
        room_id = room["locationid"]
        level = room["floor_level"]
        r_lon = float(room["x_coordinate"])
        r_lat = float(room["y_coordinate"])

        level_junctions = junctions_by_level.get(level, [])
        if not level_junctions:
            unconnected_rooms.append((room.get("code") or room.get("name"), level, "No junctions on this floor level"))
            continue

        closest_junc = None
        min_dist = float("inf")

        for junc in level_junctions:
            j_lon = float(junc["x_coordinate"])
            j_lat = float(junc["y_coordinate"])
            dist = get_ground_distance(r_lon, r_lat, j_lon, j_lat)

            if dist < min_dist:
                min_dist = dist
                closest_junc = junc

        if closest_junc and min_dist <= MAX_SNAPPING_METERS:
            junc_id = closest_junc["locationid"]
            doorway_weight = round(max(min_dist, MIN_DOORWAY_METERS), 2)

            # Room -> Corridor Junction
            if (room_id, junc_id) not in existing_edges:
                new_segments.append({
                    "start_location_id": room_id,
                    "end_location_id": junc_id,
                    "distance": doorway_weight,
                    "is_accessible": True
                })
                existing_edges.add((room_id, junc_id))

            # Corridor Junction -> Room
            if (junc_id, room_id) not in existing_edges:
                new_segments.append({
                    "start_location_id": junc_id,
                    "end_location_id": room_id,
                    "distance": doorway_weight,
                    "is_accessible": True
                })
                existing_edges.add((junc_id, room_id))
        else:
            reason = f"Closest junction is {min_dist:.1f}m away (> {MAX_SNAPPING_METERS}m limit)" if closest_junc else "None found"
            unconnected_rooms.append((room.get("code") or room.get("name"), level, reason))

    print(f"\nGenerated {len(new_segments)} new doorway connector edges.")

    if unconnected_rooms:
        print(f"\n[NOTICE] {len(unconnected_rooms)} rooms exceeded the {MAX_SNAPPING_METERS}m threshold:")
        for name_code, lvl, reason in unconnected_rooms[:10]:
            print(f"  - {name_code} (Floor {lvl}): {reason}")
        if len(unconnected_rooms) > 10:
            print(f"  ... and {len(unconnected_rooms) - 10} more.")

    # 6. Insert new edges in batches
    if new_segments:
        print(f"\nWriting {len(new_segments)} edges to path_segments in Supabase...")
        inserted_count = 0
        for i in range(0, len(new_segments), BATCH_SIZE):
            chunk = new_segments[i:i + BATCH_SIZE]
            supabase.table("path_segments").insert(chunk).execute()
            inserted_count += len(chunk)
            print(f"  Inserted {inserted_count}/{len(new_segments)} edges...")

        print("Doorway edge snapping completed successfully!")
    else:
        print("No new edges needed. All destination rooms are already connected.")

if __name__ == "__main__":
    main()