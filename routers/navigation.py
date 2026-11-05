from fastapi import APIRouter, HTTPException, Query
from typing import Optional, List, Any
from database import supabase
from services.graph_service import graph_service

router = APIRouter(prefix="/api/navigation", tags=["Navigation"])

def resolve_location(identifier: str) -> dict | None:
    """
    Resolves an input query case-insensitively across:
    1. Numeric locationid (e.g., '14' or 14)
    2. Code (exact or case-insensitive)
    3. Label (exact or case-insensitive)
    4. Name / Code / Label substring match
    """
    clean_id = str(identifier).strip()
    if not clean_id:
        return None

    # 1. Check if the user passed a numeric locationid directly from Swagger UI
    if clean_id.isdigit():
        res = (
            supabase.table("location")
            .select("locationid, code, name, label, floorid, x_coordinate, y_coordinate, type")
            .eq("locationid", int(clean_id))
            .limit(1)
            .execute()
        )
        if res.data:
            return res.data[0]

    # 2. Exact case-insensitive match on code (e.g., "GATE-1", "ROOM-MAE-401-F4")
    res = (
        supabase.table("location")
        .select("locationid, code, name, label, floorid, x_coordinate, y_coordinate, type")
        .ilike("code", clean_id)
        .limit(1)
        .execute()
    )
    if res.data:
        return res.data[0]

    # 3. Exact case-insensitive match on label (e.g., "Gate 1", "E405")
    res = (
        supabase.table("location")
        .select("locationid, code, name, label, floorid, x_coordinate, y_coordinate, type")
        .ilike("label", clean_id)
        .limit(1)
        .execute()
    )
    if res.data:
        return res.data[0]

    # 4. Partial substring search across code, label, or name
    res = (
        supabase.table("location")
        .select("locationid, code, name, label, floorid, x_coordinate, y_coordinate, type")
        .or_(f"code.ilike.%{clean_id}%,label.ilike.%{clean_id}%,name.ilike.%{clean_id}%")
        .limit(1)
        .execute()
    )
    if res.data:
        return res.data[0]

    return None

# -------------------------------------------------------------
# GET /api/navigation/route
# -------------------------------------------------------------
@router.get(
    "/route",
    summary="Get Shortest Navigation Route",
    description="Calculates the shortest walking route between any two locations using Dijkstra. Accepts location IDs, room codes, labels, or names (e.g., 'Gate 1', 'E405').",
)
def get_route(
    start: str = Query(
        ...,
        description="Origin room code, label, name, or location ID (e.g. 'Gate 1', 'PARKING-1', or ID)",
        examples=["Gate 1"],
    ),
    end: str = Query(
        ...,
        description="Destination room code, label, name, or location ID (e.g. '401', 'E405', or ID)",
        examples=["401"],
    ),
    accessible_only: bool = Query(
        False,
        description="Restrict route to wheelchair-accessible paths (ignores stairs)",
    ),
):
    start_loc = resolve_location(start)
    if not start_loc:
        raise HTTPException(status_code=404, detail=f"Start location '{start}' could not be found.")

    end_loc = resolve_location(end)
    if not end_loc:
        raise HTTPException(status_code=404, detail=f"Destination location '{end}' could not be found.")

    result = graph_service.calculate_route(
        start_id=start_loc["locationid"],
        end_id=end_loc["locationid"],
        accessible_only=accessible_only,
    )

    if not result:
        mode_note = " (accessible mode)" if accessible_only else ""
        raise HTTPException(
            status_code=404,
            detail=f"No route found between '{start_loc['name']}' and '{end_loc['name']}'{mode_note}. Note: Multi-floor access requires stairs as there are no elevators.",
        )

    return {
        "status": "success",
        "start": start_loc,
        "destination": end_loc,
        "accessible_only": accessible_only,
        **result,
    }

# -------------------------------------------------------------
# GET /api/navigation/destinations (with /search alias)
# -------------------------------------------------------------
@router.get(
    "/destinations",
    summary="Search Destinations",
    description="Search rooms, offices, gates, and parking areas by name, code, or label.",
)
@router.get(
    "/search",
    include_in_schema=False,  # Hidden alias for frontend compatibility
)
def search_destinations(
    q: Optional[str] = Query(None, description="Search term (e.g. 'Gate', 'Dean', '401', 'Lab')"),
    query: Optional[str] = Query(None, description="Alternative parameter for search term"),
    floor_level: Optional[int] = Query(None, description="Filter by floor number (1 - 6)"),
    limit: int = Query(30, ge=1, le=100, description="Max results to return"),
):
    search_term = (q or query or "").strip()

    # Query location with floor_level from related floors table
    req = (
        supabase.table("location")
        .select("locationid, code, name, label, type, building_code, floorid, floors(floor_level)")
        .neq("type", "junction")  # Exclude internal corridor vertices
    )

    if search_term:
        req = req.or_(
            f"name.ilike.%{search_term}%,code.ilike.%{search_term}%,label.ilike.%{search_term}%"
        )

    res = req.limit(limit).execute()
    data = res.data or []

    # Flatten floor_level for cleaner Swagger UI output
    results = []
    for item in data:
        floor_info = item.pop("floors", None) or {}
        item["floor_level"] = floor_info.get("floor_level")

        if floor_level is not None and item["floor_level"] != floor_level:
            continue
        results.append(item)

    return results

# -------------------------------------------------------------
# POST /api/navigation/reload-graph
# -------------------------------------------------------------
@router.post(
    "/reload-graph",
    summary="Reload In-Memory Graph",
    description="Reconstructs the NetworkX navigation graph from the latest database state.",
)
def reload_graph():
    nodes, edges = graph_service.build_graph()
    return {
        "message": "Navigation graph reloaded successfully",
        "total_nodes": nodes,
        "total_edges": edges,
    }