from typing import Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from database import supabase
from dependencies import require_admin
from services.graph_service import campus_graph_service

router = APIRouter(prefix="/api/navigation", tags=["Navigation"])

# --- Pydantic Models ---

class RouteRequest(BaseModel):
    from_location: Any = Field(None, alias="from")
    to_location: Any = Field(None, alias="to")
    emergency: bool = False
    pwd: bool = False

    class Config:
        populate_by_name = True

class LocationRename(BaseModel):
    name: str


# --- Public Navigation & Search Endpoints ---

@router.get("/locations")
def get_searchable_locations(
    q: Optional[str] = Query(default=None, description="Optional search query"),
    limit: int = Query(default=8, ge=1, le=500),
    all_items: bool = Query(default=False, description="Return full searchable index"),
):
    """
    Returns searchable campus locations (buildings, gates, parking, rooms),
    filtering out internal corridor junctions and stair landings.
    """
    if all_items:
        return {"locations": campus_graph_service.get_all_locations()}
    if q is not None:
        return {"locations": campus_graph_service.search_locations(q, limit=limit)}
    return {"locations": campus_graph_service.get_all_locations()}


@router.post("/route")
def calculate_route_post(payload: RouteRequest):
    """
    Computes shortest path with Javier Lobby rule, Gate 1 one-way lanes,
    emergency exit mode, and PWD step-free fallback warnings.
    Matches frontend getRemoteRoute() contract.
    """
    if not payload.from_location:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Origin ('from') location is required.",
        )
    if not payload.emergency and not payload.to_location:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Destination ('to') location is required when emergency mode is off.",
        )

    result = campus_graph_service.compute_route(
        from_input=payload.from_location,
        to_input=payload.to_location,
        emergency=payload.emergency,
        pwd=payload.pwd,
    )
    if not result:
        return None
    return result


@router.get("/route")
def calculate_route_get(
    start: str = Query(..., description="Origin room code, id, or name"),
    destination: Optional[str] = Query(None, description="Destination room code, id, or name"),
    accessible_only: bool = Query(False, description="Step-free PWD routing"),
    emergency: bool = Query(False, description="Route to nearest emergency exit"),
):
    """GET endpoint for Swagger UI testing and query-string navigation requests."""
    result = campus_graph_service.compute_route(
        from_input=start,
        to_input=destination,
        emergency=emergency,
        pwd=accessible_only,
    )
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No walkable route found between the specified locations.",
        )
    return result


# --- Protected Admin Endpoints ---

@router.post("/reload-graph")
def reload_navigation_graph(_admin: dict = Depends(require_admin)):
    """
    Admin-only endpoint: Refreshes the in-memory graph from Supabase/GeoJSON.
    """
    stats = campus_graph_service.reload_graph()
    return {"status": "reloaded", **stats}


@router.put("/locations/{location_id}")
def rename_map_location(location_id: int, payload: LocationRename, _admin: dict = Depends(require_admin)):
    """
    Admin-only: Renames the location in the database and automatically refreshes 
    the in-memory routing graph so the whole system immediately sees the change.
    """
    new_name = payload.name.strip()
    res = supabase.table("location").update({"name": new_name}).eq("locationid", location_id).select().execute()
    
    if not res.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Location not found or update failed."
        )
        
    # Auto-trigger graph reload so navigation engine learns the new name immediately
    campus_graph_service.reload_graph()
    
    return {"status": "renamed", "location": res.data[0]}