from typing import Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, Field
from database import supabase
from dependencies import require_admin, get_current_user
from services.audit_service import diff, error_text, get_client_ip, log_audit
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

class RecentSearchCreate(BaseModel):
    location_id: Optional[Any] = None
    location_name: str


# --- Public Navigation & Search Endpoints ---

@router.get("/locations")
def get_searchable_locations(
    q: Optional[str] = Query(default=None, description="Optional search query"),
    limit: int = Query(default=8, ge=1, le=500),
    all_items: bool = Query(default=False, description="Return full searchable index"),
):
    if all_items:
        return {"locations": campus_graph_service.get_all_locations()}
    if q is not None:
        return {"locations": campus_graph_service.search_locations(q, limit=limit)}
    return {"locations": campus_graph_service.get_all_locations()}


@router.post("/route")
def calculate_route_post(payload: RouteRequest):
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


# --- Protected User Endpoints (Recent Searches) ---

@router.get("/recent-searches")
def get_recent_searches(user: dict = Depends(get_current_user)):
    """Fetches the logged-in user's recent searches."""
    try:
        res = supabase.table("recent_searches").select("*").eq("user_id", user["id"]).order("searched_at", desc=True).execute()
        return {"recent_searches": res.data or []}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/recent-searches")
def add_recent_search(payload: RecentSearchCreate, user: dict = Depends(get_current_user)):
    """Saves a recent search. The database trigger automatically enforces the 5-item limit."""
    try:
        if payload.location_id is not None:
            try:
                loc_id = int(payload.location_id)
            except (ValueError, TypeError):
                loc_id = None

        row = {
            "user_id": user["id"],
            "location_id": loc_id,
            "location_name": payload.location_name
        }
        res = supabase.table("recent_searches").insert(row).execute()
        return {"status": "added", "data": res.data[0] if res.data else None}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/recent-searches/all")
def clear_all_recent_searches(user: dict = Depends(get_current_user)):
    """Clears all recent searches for the logged-in user."""
    try:
        supabase.table("recent_searches").delete().eq("user_id", user["id"]).execute()
        return {"status": "cleared"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/recent-searches/{search_id}")
def delete_recent_search(search_id: str, user: dict = Depends(get_current_user)):
    """Deletes a specific recent search."""
    try:
        supabase.table("recent_searches").delete().eq("id", search_id).eq("user_id", user["id"]).execute()
        return {"status": "deleted"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --- Protected Admin Endpoints ---

@router.post("/reload-graph")
def reload_navigation_graph(_admin: dict = Depends(require_admin)):
    stats = campus_graph_service.reload_graph()
    return {"status": "reloaded", **stats}

def _fetch_location_row(location_id: int) -> Optional[dict]:
    try:
        res = supabase.table("location").select("locationid, name, code").eq("locationid", location_id).limit(1).execute()
        return res.data[0] if res.data else None
    except Exception as exc:
        print(f"[LOOKit Audit] Could not read location {location_id} for audit context: {exc}")
        return None

@router.put("/locations/{location_id}")
def rename_map_location(location_id: int, payload: LocationRename, request: Request, admin: dict = Depends(require_admin)):
    ip = get_client_ip(request)
    new_name = payload.name.strip()
    before = _fetch_location_row(location_id)
    old_name = before.get("name") if before else None
    try:
        res = supabase.table("location").update({"name": new_name}).eq("locationid", location_id).execute()
        if not res.data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Location not found or update failed.")
    except Exception as exc:
        log_audit(admin, "UPDATE", "location", entity_id=location_id, entity_label=old_name,
                  status="failed", error=error_text(exc), ip=ip)
        raise

    log_audit(admin, "UPDATE", "location", entity_id=location_id, entity_label=new_name,
              changes=diff({"name": old_name}, {"name": new_name}), ip=ip)

    try:
        campus_graph_service.reload_graph()
    except Exception as exc:
        log_audit(admin, "UPDATE", "location", entity_id=location_id, entity_label=new_name,
                  status="failed", error=f"Location renamed, but graph reload failed: {error_text(exc)}", ip=ip)
        raise

    return {"status": "renamed", "location": res.data[0]}