from typing import Optional
<<<<<<< HEAD
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from database import supabase
from dependencies import require_admin
=======
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from database import supabase
from dependencies import require_admin
from services.audit_service import diff, error_text, get_client_ip, log_audit
>>>>>>> 0892d3b (updated for admin dashboard)

router = APIRouter(prefix="/api/staff", tags=["Staff"])

# --- Pydantic Models for Admin Forms ---

class StaffCreate(BaseModel):
    employee_number: Optional[int] = None
    first_name: str
    last_name: str
    role: Optional[str] = None
    email: Optional[str] = None
    department_id: Optional[int] = None
    office_location_id: Optional[int] = None

class StaffUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    role: Optional[str] = None
    email: Optional[str] = None
    department_id: Optional[int] = None
    office_location_id: Optional[int] = None


# --- Public Endpoints ---

@router.get("")
def get_all_staff():
    """
    Fetches all staff members joined with departments and locations.
    Returns the exact format required by the frontend StaffScreen.
    """
    try:
        # Fetch staff with joined department names
        staff_res = supabase.table("staff_members").select("*, departments(name)").execute()
        
        # Fetch locations to map office_location_id to the string room code
        loc_res = supabase.table("location").select("locationid, code").execute()
        loc_map = {r["locationid"]: r.get("code") for r in (loc_res.data or [])}

        results = []
        for row in (staff_res.data or []):
            meta = row.get("metadata") or {}
            dept_name = row.get("departments", {}).get("name") if row.get("departments") else "Unknown Office"
            loc_id = row.get("office_location_id")
            room_code = loc_map.get(loc_id) if loc_id else None

            results.append({
                "id": row["employee_number"],
                "name": meta.get("full_name") or f"{row.get('first_name', '')} {row.get('last_name', '')}".strip(),
                "position": row.get("role") or "",
                "office": dept_name,
                "groups": meta.get("groups") or [],
                "office_location_id": loc_id,
                "room_code": room_code,
                # Extra fields required by the Admin Update form
                "firstName": row.get("first_name", ""),
                "lastName": row.get("last_name", ""),
                "email": row.get("email", ""),
                "departmentId": row.get("department_id")
            })
        
        # Sort by employee_number (id) matching the frontend's default order
        results.sort(key=lambda x: x["id"])
        return {"staff": results}

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch staff directory: {str(e)}"
        )

@router.get("/sections")
def get_staff_sections():
    """Returns static sections for Staff Directory groupings."""
    return {
        "sections": [
            {"id": "offices", "title": "Offices & Administration"},
            {"id": "cbea", "title": "College of Business, Entrepreneurship, and Accountancy"},
            {"id": "ics", "title": "Institute of Computer Studies"},
            {"id": "cas", "title": "College of Arts and Sciences"},
            {"id": "ced", "title": "College of Education"}
        ]
    }


# --- Admin GET Endpoints (Form Dropdowns) ---

@router.get("/departments")
def get_departments():
    """Provides the Department dropdown data for the Admin Staff form."""
    res = supabase.table("departments").select("departmentid, name").order("name").execute()
    return {"departments": [{"id": d["departmentid"], "name": d["name"]} for d in (res.data or [])]}

@router.get("/locations")
def get_admin_locations():
    """Provides the Office dropdown (raw DB locations) data for the Admin Staff form."""
    res = supabase.table("location").select("locationid, name, code, building_code").order("name").limit(5000).execute()
    return {
        "locations": [
            {"id": l["locationid"], "name": l["name"], "code": l.get("code"), "building": l.get("building_code")}
            for l in (res.data or [])
        ]
    }


<<<<<<< HEAD
# --- Protected Admin CRUD Endpoints ---

@router.post("")
def add_staff(payload: StaffCreate, _admin: dict = Depends(require_admin)):
    """Admin-only: Adds a new staff member."""
    data = payload.dict(exclude_none=True)
    res = supabase.table("staff_members").insert(data).select().execute()
    if not res.data:
        raise HTTPException(status_code=400, detail="Failed to add staff member.")
    return {"status": "added", "staff": res.data[0]}

@router.put("/{employee_number}")
def update_staff(employee_number: int, payload: StaffUpdate, _admin: dict = Depends(require_admin)):
    """Admin-only: Updates an existing staff member."""
    data = payload.dict(exclude_unset=True)
    if not data:
        raise HTTPException(status_code=400, detail="No fields provided to update.")
    res = supabase.table("staff_members").update(data).eq("employee_number", employee_number).select().execute()
    if not res.data:
        raise HTTPException(status_code=400, detail="Staff update failed.")
    return {"status": "updated", "staff": res.data[0]}

@router.delete("/{employee_number}")
def delete_staff(employee_number: int, _admin: dict = Depends(require_admin)):
    """Admin-only: Deletes a staff member."""
    res = supabase.table("staff_members").delete().eq("employee_number", employee_number).execute()
=======
# --- Audit helpers ---

STAFF_AUDIT_FIELDS = ("first_name", "last_name", "role", "email", "department_id", "office_location_id")


def _staff_label(row: Optional[dict]) -> Optional[str]:
    row = row or {}
    meta = row.get("metadata")
    full_name = meta.get("full_name") if isinstance(meta, dict) else None
    return full_name or f"{row.get('first_name') or ''} {row.get('last_name') or ''}".strip() or None


def _fetch_staff_row(employee_number: int) -> Optional[dict]:
    """Best-effort read used only for audit context. Never raises."""
    try:
        res = supabase.table("staff_members").select("*").eq("employee_number", employee_number).limit(1).execute()
        return res.data[0] if res.data else None
    except Exception as exc:
        print(f"[LOOKit Audit] Could not read staff row {employee_number} for audit context: {exc}")
        return None


# --- Protected Admin CRUD Endpoints ---

@router.post("")
def add_staff(payload: StaffCreate, request: Request, admin: dict = Depends(require_admin)):
    """Admin-only: Adds a new staff member."""
    ip = get_client_ip(request)
    data = payload.dict(exclude_none=True)
    try:
        res = supabase.table("staff_members").insert(data).execute()
        if not res.data:
            raise HTTPException(status_code=400, detail="Failed to add staff member.")
    except HTTPException as exc:
        log_audit(admin, "CREATE", "staff", entity_id=data.get("employee_number"), entity_label=_staff_label(data),
                  status="failed", error=error_text(exc), ip=ip)
        raise
    except Exception as exc:
        log_audit(admin, "CREATE", "staff", entity_id=data.get("employee_number"), entity_label=_staff_label(data),
                  status="failed", error=error_text(exc), ip=ip)
        raise
    row = res.data[0]
    log_audit(admin, "CREATE", "staff", entity_id=row.get("employee_number"),
              entity_label=_staff_label(row) or _staff_label(data),
              changes=diff({}, data), ip=ip)
    return {"status": "added", "staff": row}

@router.put("/{employee_number}")
def update_staff(employee_number: int, payload: StaffUpdate, request: Request, admin: dict = Depends(require_admin)):
    """Admin-only: Updates an existing staff member."""
    ip = get_client_ip(request)
    data = payload.dict(exclude_unset=True)
    before = None
    try:
        if not data:
            raise HTTPException(status_code=400, detail="No fields provided to update.")
        before = _fetch_staff_row(employee_number)
        res = supabase.table("staff_members").update(data).eq("employee_number", employee_number).execute()
        if not res.data:
            raise HTTPException(status_code=400, detail="Staff update failed.")
    except HTTPException as exc:
        log_audit(admin, "UPDATE", "staff", entity_id=employee_number, entity_label=_staff_label(before),
                  status="failed", error=error_text(exc), ip=ip)
        raise
    except Exception as exc:
        log_audit(admin, "UPDATE", "staff", entity_id=employee_number, entity_label=_staff_label(before),
                  status="failed", error=error_text(exc), ip=ip)
        raise
    after = res.data[0]
    log_audit(admin, "UPDATE", "staff", entity_id=employee_number,
              entity_label=_staff_label(after) or _staff_label(before),
              changes=diff(before or {}, data), ip=ip)
    return {"status": "updated", "staff": after}

@router.delete("/{employee_number}")
def delete_staff(employee_number: int, request: Request, admin: dict = Depends(require_admin)):
    """Admin-only: Deletes a staff member."""
    ip = get_client_ip(request)
    before = _fetch_staff_row(employee_number)
    try:
        res = supabase.table("staff_members").delete().eq("employee_number", employee_number).execute()
    except Exception as exc:
        log_audit(admin, "DELETE", "staff", entity_id=employee_number, entity_label=_staff_label(before),
                  status="failed", error=error_text(exc), ip=ip)
        raise
    label = _staff_label(before) or ("(no matching row)" if not res.data else None)
    snapshot = {f: {"from": before.get(f), "to": None} for f in STAFF_AUDIT_FIELDS if f in before} if before else None
    log_audit(admin, "DELETE", "staff", entity_id=employee_number, entity_label=label, changes=snapshot, ip=ip)
>>>>>>> 0892d3b (updated for admin dashboard)
    return {"status": "deleted", "data": res.data}