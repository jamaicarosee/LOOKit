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
    title: Optional[str] = None
    first_name: str
    middle_initial: Optional[str] = None
    last_name: str
    role: Optional[str] = None
    email: Optional[str] = None
    department_id: Optional[int] = None
    office_location_id: Optional[int] = None
    section: Optional[str] = None
    secondary_role: Optional[str] = None
    secondary_department_id: Optional[int] = None


class StaffUpdate(BaseModel):
    title: Optional[str] = None
    first_name: Optional[str] = None
    middle_initial: Optional[str] = None
    last_name: Optional[str] = None
    role: Optional[str] = None
    email: Optional[str] = None
    department_id: Optional[int] = None
    office_location_id: Optional[int] = None
    section: Optional[str] = None
    secondary_role: Optional[str] = None
    secondary_department_id: Optional[int] = None


# --- Internal Helpers ---
def _clean(value: Optional[str]) -> Optional[str]:
    """Trims whitespace; returns None for empty strings."""
    if value is None:
        return None
    value = str(value).strip()
    return value or None


def _normalize_middle_initial(value: Optional[str]) -> Optional[str]:
    """'r' -> 'R.', 'R' -> 'R.', 'M.A.' stays 'M.A.'. Empty -> None."""
    value = _clean(value)
    if not value:
        return None
    if len(value) > 6:
        raise HTTPException(status_code=422, detail="Middle initial must be 6 characters or fewer.")
    if len(value) == 1 and value.isalpha():
        return value.upper() + "."
    return value


def _compose_full_name(title=None, first_name=None, middle_initial=None, last_name=None) -> str:
    """Display name: '<Status> <First> <M.I.> <Last>' with any empty part skipped."""
    parts = [title, first_name, middle_initial, last_name]
    return " ".join(str(p).strip() for p in parts if p and str(p).strip())


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
                "name": _compose_full_name(
                    row.get("title"), row.get("first_name"), row.get("middle_initial"), row.get("last_name")
                ) or meta.get("full_name") or "",
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
                "title": row.get("title") or "",
                "firstName": row.get("first_name", ""),
                "middleInitial": row.get("middle_initial") or "",
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
STAFF_AUDIT_FIELDS = ("title", "first_name", "middle_initial", "last_name", "role", "email", "department_id", "office_location_id")


def _staff_label(row: Optional[dict]) -> Optional[str]:
    row = row or {}
    meta = row.get("metadata")
    full_name = meta.get("full_name") if isinstance(meta, dict) else None
    composed = _compose_full_name(row.get("title"), row.get("first_name"), row.get("middle_initial"), row.get("last_name"))
    return composed or full_name or None


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

    for key in ("title", "first_name", "last_name"):
        if key in data:
            data[key] = _clean(data[key])
    if not data.get("first_name") or not data.get("last_name"):
        raise HTTPException(status_code=422, detail="First name and last name are required.")
    if "middle_initial" in data:
        data["middle_initial"] = _normalize_middle_initial(data["middle_initial"])
        if data["middle_initial"] is None:
            data.pop("middle_initial")

    full_name = _compose_full_name(
        data.get("title"), data.get("first_name"), data.get("middle_initial"), data.get("last_name")
    )
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

        name_keys = ("title", "first_name", "middle_initial", "last_name")
        name_touched = any(k in data for k in name_keys)
        if "title" in data:
            data["title"] = _clean(data["title"])
        if "middle_initial" in data:
            data["middle_initial"] = _normalize_middle_initial(data["middle_initial"])
        for key in ("first_name", "last_name"):
            if key in data:
                data[key] = _clean(data[key])
                if not data[key]:
                    raise HTTPException(status_code=422, detail="First name and last name cannot be empty.")

        section_provided = "section" in data
        requested_section = data.pop("section", None)
        sec_role_provided = "secondary_role" in data
        secondary_role = data.pop("secondary_role", None)
        sec_dept_provided = "secondary_department_id" in data
        secondary_department_id = data.pop("secondary_department_id", None)
        dept_changed = "department_id" in data

        needs_meta_sync = (
            name_touched
            or dept_changed
            or section_provided
            or sec_role_provided
            or sec_dept_provided
        )

        if needs_meta_sync:
            current_meta = dict((before.get("metadata") or {}) if before else {})

            if name_touched:
                merged = {k: (data[k] if k in data else (before or {}).get(k)) for k in name_keys}
                current_meta["full_name"] = _compose_full_name(
                    merged["title"], merged["first_name"], merged["middle_initial"], merged["last_name"]
                )

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