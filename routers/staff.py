from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from database import supabase
from dependencies import require_admin
from services.audit_service import diff, error_text, get_client_ip, log_audit
from services.staff_categorizer import (
    STAFF_SECTIONS,
    normalize_groups,
    normalize_section_id,
    resolve_section_from_department,
)

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
    section: Optional[str] = None
    secondary_role: Optional[str] = None
    secondary_department_id: Optional[int] = None


class StaffUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    role: Optional[str] = None
    email: Optional[str] = None
    department_id: Optional[int] = None
    office_location_id: Optional[int] = None
    section: Optional[str] = None
    secondary_role: Optional[str] = None
    secondary_department_id: Optional[int] = None


# --- Internal Helpers ---
def _fetch_department_name(department_id: Optional[int]) -> Optional[str]:
    """Resolves a department's display name by ID for auto-categorization."""
    if not department_id:
        return None
    try:
        res = (
            supabase.table("departments")
            .select("name")
            .eq("departmentid", department_id)
            .limit(1)
            .execute()
        )
        return res.data[0].get("name") if res.data else None
    except Exception as exc:
        print(f"[LOOKit Staff] Could not resolve department {department_id}: {exc}")
        return None


def _resolve_target_section(section: Optional[str], department_id: Optional[int]) -> str:
    """Uses an explicit valid section if provided; otherwise resolves from department."""
    explicit = normalize_section_id(section)
    if explicit:
        return explicit
    dept_name = _fetch_department_name(department_id)
    return resolve_section_from_department(dept_name)


# --- Public Endpoints ---
@router.get("")
def get_all_staff():
    """
    Fetches all staff members joined with departments and locations.
    Returns the exact format required by the frontend StaffScreen.
    """
    try:
        staff_res = supabase.table("staff_members").select("*, departments(name)").execute()

        loc_res = supabase.table("location").select("locationid, code").execute()
        loc_map = {r["locationid"]: r.get("code") for r in (loc_res.data or [])}

        dept_res = supabase.table("departments").select("departmentid, name").execute()
        dept_map = {d["departmentid"]: d.get("name") for d in (dept_res.data or [])}

        results = []
        for row in (staff_res.data or []):
            meta = row.get("metadata") or {}
            dept_name = row.get("departments", {}).get("name") if row.get("departments") else "Unknown Office"
            loc_id = row.get("office_location_id")
            room_code = loc_map.get(loc_id) if loc_id else None
            groups = normalize_groups(meta.get("groups"), dept_name)

            sec_dept_id = meta.get("secondary_department_id")
            sec_dept_name = dept_map.get(sec_dept_id) if sec_dept_id else None
            sec_role = meta.get("secondary_role") or ""

            results.append({
                "id": row["employee_number"],
                "name": meta.get("full_name") or f"{row.get('first_name', '')} {row.get('last_name', '')}".strip(),
                "position": row.get("role") or "",
                "secondaryPosition": sec_role,
                "office": dept_name,
                "secondaryOffice": sec_dept_name or "",
                "groups": groups,
                "section": groups[0],
                "office_location_id": loc_id,
                "officeLocationId": loc_id,
                "room_code": room_code,
                # Extra fields required by the Admin Update form
                "firstName": row.get("first_name", ""),
                "lastName": row.get("last_name", ""),
                "email": row.get("email", ""),
                "departmentId": row.get("department_id"),
                "secondaryDepartmentId": sec_dept_id,
            })

        results.sort(key=lambda x: x["id"])
        return {"staff": results}

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch staff directory: {str(e)}",
        )


@router.get("/sections")
def get_staff_sections():
    """Returns canonical sections for Staff Directory groupings."""
    return {"sections": STAFF_SECTIONS}


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
    """Admin-only: Adds a new staff member with automatic/explicit section and optional secondary position."""
    ip = get_client_ip(request)
    data = payload.dict(exclude_none=True)
    requested_section = data.pop("section", None)
    secondary_role = data.pop("secondary_role", None)
    secondary_department_id = data.pop("secondary_department_id", None)

    full_name = f"{data.get('first_name', '')} {data.get('last_name', '')}".strip()
    resolved_section = _resolve_target_section(requested_section, data.get("department_id"))

    meta = {"full_name": full_name, "groups": [resolved_section]}
    if secondary_role and str(secondary_role).strip():
        meta["secondary_role"] = str(secondary_role).strip()
    if secondary_department_id is not None:
        meta["secondary_department_id"] = secondary_department_id
    data["metadata"] = meta

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
    """Admin-only: Updates an existing staff member and keeps metadata (groups & secondary position) synchronized."""
    ip = get_client_ip(request)
    data = payload.dict(exclude_unset=True)
    before = None
    try:
        if not data:
            raise HTTPException(status_code=400, detail="No fields provided to update.")

        before = _fetch_staff_row(employee_number)
        section_provided = "section" in data
        requested_section = data.pop("section", None)
        sec_role_provided = "secondary_role" in data
        secondary_role = data.pop("secondary_role", None)
        sec_dept_provided = "secondary_department_id" in data
        secondary_department_id = data.pop("secondary_department_id", None)
        dept_changed = "department_id" in data

        needs_meta_sync = (
            "first_name" in data
            or "last_name" in data
            or dept_changed
            or section_provided
            or sec_role_provided
            or sec_dept_provided
        )

        if needs_meta_sync:
            current_meta = dict((before.get("metadata") or {}) if before else {})

            if "first_name" in data or "last_name" in data:
                new_fn = data.get("first_name", before.get("first_name", "") if before else "")
                new_ln = data.get("last_name", before.get("last_name", "") if before else "")
                current_meta["full_name"] = f"{new_fn} {new_ln}".strip()

            if section_provided or dept_changed:
                target_dept_id = (
                    data.get("department_id")
                    if dept_changed
                    else (before.get("department_id") if before else None)
                )
                resolved_section = _resolve_target_section(requested_section, target_dept_id)
                current_meta["groups"] = [resolved_section]

            if sec_role_provided:
                cleaned_role = secondary_role.strip() if isinstance(secondary_role, str) else None
                if cleaned_role:
                    current_meta["secondary_role"] = cleaned_role
                else:
                    current_meta.pop("secondary_role", None)

            if sec_dept_provided:
                if secondary_department_id is not None:
                    current_meta["secondary_department_id"] = secondary_department_id
                else:
                    current_meta.pop("secondary_department_id", None)

            data["metadata"] = current_meta

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
    return {"status": "deleted", "data": res.data}