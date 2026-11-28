import re
from typing import Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from pydantic import BaseModel, Field, field_validator
from database import supabase
from dependencies import get_current_user_profile, require_admin
from services.audit_service import diff, error_text, get_client_ip, log_audit
from services.graph_service import campus_graph_service
from services.rate_limit_service import rate_limit

router = APIRouter(prefix="/api/navigation", tags=["Navigation"])

MAX_RECENT_SEARCHES_PER_USER = 30
_SEARCH_ID_RE = re.compile(r"^[A-Za-z0-9_-]{1,64}$")


# --- Pydantic Models ---

class RouteRequest(BaseModel):
    from_location: Any = Field(None, alias="from")
    to_location: Any = Field(None, alias="to")
    emergency: bool = False
    pwd: bool = False
    accessible_only: bool = Field(False, alias="accessibleOnly")

    model_config = {"populate_by_name": True}

    @property
    def is_pwd(self) -> bool:
        return self.pwd or self.accessible_only


class LocationRename(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)

    @field_validator("name")
    @classmethod
    def _clean_name(cls, value: str) -> str:
        cleaned = " ".join(value.split())
        if not cleaned:
            raise ValueError("Location name cannot be empty.")
        return cleaned


class RecentSearchCreate(BaseModel):
    location_id: Optional[Any] = None
    location_name: str = Field(..., min_length=1, max_length=200)

    @field_validator("location_name")
    @classmethod
    def _clean_location_name(cls, value: str) -> str:
        cleaned = " ".join(value.split())
        if not cleaned:
            raise ValueError("location_name cannot be empty.")
        return cleaned


# --- Public Navigation & Search Endpoints ---

@router.get(
    "/locations",
    dependencies=[Depends(rate_limit(limit=90, window_seconds=60, scope="nav_locations"))],
)
def get_searchable_locations(
    response: Response,
    q: Optional[str] = Query(default=None, max_length=100, description="Optional search query"),
    limit: int = Query(default=8, ge=1, le=500),
    all_items: bool = Query(default=False, description="Return full searchable index"),
):
    response.headers["Cache-Control"] = "public, max-age=120"
    if all_items:
        return {"locations": campus_graph_service.get_all_locations()}
    if q is not None and q.strip():
        return {"locations": campus_graph_service.search_locations(q.strip(), limit=limit)}
    return {"locations": campus_graph_service.get_all_locations()}


@router.post(
    "/route",
    dependencies=[Depends(rate_limit(limit=40, window_seconds=60, scope="nav_route"))],
)
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
        pwd=payload.is_pwd,
    )
    if not result:
        return None
    return result


@router.get(
    "/route",
    dependencies=[Depends(rate_limit(limit=40, window_seconds=60, scope="nav_route"))],
)
def calculate_route_get(
    start: str = Query(..., min_length=1, max_length=200, description="Origin room code, id, or name"),
    destination: Optional[str] = Query(None, max_length=200, description="Destination room code, id, or name"),
    accessible_only: bool = Query(False, description="Step-free PWD routing"),
    pwd: bool = Query(False, description="Alias for accessible_only"),
    emergency: bool = Query(False, description="Route to nearest emergency exit"),
):
    is_pwd = accessible_only or pwd
    result = campus_graph_service.compute_route(
        from_input=start,
        to_input=destination,
        emergency=emergency,
        pwd=is_pwd,
    )
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No walkable route found between the specified locations.",
        )
    return result


# --- Protected User Endpoints (Recent Searches — enforces is_active) ---

@router.get(
    "/recent-searches",
    dependencies=[Depends(rate_limit(limit=60, window_seconds=60, scope="recent_searches_read"))],
)
def get_recent_searches(profile: dict = Depends(get_current_user_profile)):
    try:
        res = (
            supabase.table("recent_searches")
            .select("id, location_id, location_name, searched_at")
            .eq("user_id", profile["id"])
            .order("searched_at", desc=True)
            .limit(MAX_RECENT_SEARCHES_PER_USER)
            .execute()
        )
        return {"recent_searches": res.data or []}
    except Exception as exc:
        print(f"[LOOKit Nav] Failed to fetch recent searches for {profile['id']}: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to load recent searches.",
        )


@router.post(
    "/recent-searches",
    dependencies=[Depends(rate_limit(limit=30, window_seconds=60, scope="recent_searches_write"))],
)
def add_recent_search(payload: RecentSearchCreate, profile: dict = Depends(get_current_user_profile)):
    try:
        loc_id = None
        if payload.location_id is not None:
            try:
                loc_id = int(payload.location_id)
            except (ValueError, TypeError):
                loc_id = None

        row = {
            "user_id": profile["id"],
            "location_id": loc_id,
            "location_name": payload.location_name,
        }
        res = supabase.table("recent_searches").insert(row).execute()

        # Best-effort pruning so a single account cannot bloat the table
        try:
            existing = (
                supabase.table("recent_searches")
                .select("id")
                .eq("user_id", profile["id"])
                .order("searched_at", desc=True)
                .range(MAX_RECENT_SEARCHES_PER_USER, MAX_RECENT_SEARCHES_PER_USER + 20)
                .execute()
            )
            stale_ids = [r["id"] for r in (existing.data or []) if r.get("id") is not None]
            if stale_ids:
                supabase.table("recent_searches").delete().in_("id", stale_ids).eq("user_id", profile["id"]).execute()
        except Exception as prune_exc:
            print(f"[LOOKit Nav] Recent-search prune skipped: {prune_exc}")

        return {"status": "added", "data": res.data[0] if res.data else None}
    except Exception as exc:
        print(f"[LOOKit Nav] Failed to save recent search for {profile['id']}: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save recent search.",
        )


@router.delete(
    "/recent-searches/all",
    dependencies=[Depends(rate_limit(limit=15, window_seconds=60, scope="recent_searches_write"))],
)
def clear_all_recent_searches(profile: dict = Depends(get_current_user_profile)):
    try:
        supabase.table("recent_searches").delete().eq("user_id", profile["id"]).execute()
        return {"status": "cleared"}
    except Exception as exc:
        print(f"[LOOKit Nav] Failed to clear recent searches for {profile['id']}: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to clear recent searches.",
        )


@router.delete(
    "/recent-searches/{search_id}",
    dependencies=[Depends(rate_limit(limit=30, window_seconds=60, scope="recent_searches_write"))],
)
def delete_recent_search(search_id: str, profile: dict = Depends(get_current_user_profile)):
    if not _SEARCH_ID_RE.match(search_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid search ID.",
        )
    try:
        supabase.table("recent_searches").delete().eq("id", search_id).eq("user_id", profile["id"]).execute()
        return {"status": "deleted"}
    except Exception as exc:
        print(f"[LOOKit Nav] Failed to delete recent search {search_id}: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete recent search.",
        )


# --- Protected Admin Endpoints ---

@router.post(
    "/reload-graph",
    dependencies=[Depends(rate_limit(limit=5, window_seconds=60, scope="nav_admin_reload"))],
)
def reload_navigation_graph(_admin: dict = Depends(require_admin)):
    stats = campus_graph_service.reload_graph()
    return {"status": "reloaded", **stats}


def _fetch_location_row(location_id: int) -> Optional[dict]:
    try:
        res = (
            supabase.table("location")
            .select("locationid, name, label, metadata")
            .eq("locationid", location_id)
            .limit(1)
            .execute()
        )
        return res.data[0] if res.data else None
    except Exception as exc:
        print(f"[LOOKit Audit] Could not read location {location_id} for audit context: {exc}")
        return None


@router.put(
    "/locations/{location_id}",
    dependencies=[Depends(rate_limit(limit=20, window_seconds=60, scope="nav_admin_rename"))],
)
def rename_map_location(
    location_id: int,
    payload: LocationRename,
    request: Request,
    admin: dict = Depends(require_admin),
):
    ip = get_client_ip(request)
    new_name = payload.name
    before = _fetch_location_row(location_id)
    if not before:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Location not found.")
    old_name = before.get("name")

    meta = dict(before.get("metadata") or {})
    if "poi" in meta and isinstance(meta["poi"], dict):
        meta["poi"] = {**meta["poi"], "name": new_name, "fullName": new_name}
    meta["base_code"] = meta.get("base_code")

    update_payload = {
        "name": new_name,
        "label": new_name,
        "metadata": meta,
    }

    try:
        res = supabase.table("location").update(update_payload).eq("locationid", location_id).execute()
        if not res.data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Location not found or update failed.")
    except HTTPException as exc:
        log_audit(admin, "UPDATE", "location", entity_id=location_id, entity_label=old_name,
                  status="failed", error=error_text(exc), ip=ip)
        raise
    except Exception as exc:
        print(f"[LOOKit Nav] Failed renaming location {location_id}: {exc}")
        log_audit(admin, "UPDATE", "location", entity_id=location_id, entity_label=old_name,
                  status="failed", error=error_text(exc), ip=ip)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to rename location.")

    log_audit(admin, "UPDATE", "location", entity_id=location_id, entity_label=new_name,
              changes=diff({"name": old_name}, {"name": new_name}), ip=ip)

    try:
        campus_graph_service.reload_graph()
    except Exception as exc:
        print(f"[LOOKit Nav] Graph reload failed after renaming location {location_id}: {exc}")
        log_audit(admin, "UPDATE", "location", entity_id=location_id, entity_label=new_name,
                  status="failed", error=f"Location renamed, but graph reload failed: {error_text(exc)}", ip=ip)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Location renamed, but the navigation graph could not be refreshed.",
        )

    return {"status": "renamed", "location": res.data[0]}