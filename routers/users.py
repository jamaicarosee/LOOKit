import re
from datetime import datetime, timezone
from typing import Literal, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, field_validator

from database import supabase
from dependencies import require_admin
from services.audit_service import diff, error_text, get_client_ip, log_audit

router = APIRouter(prefix="/api/users", tags=["Users"])

USER_COLUMNS = (
    "id, full_name, email, role, is_active, created_at, "
    "deactivated_at, deactivated_by, must_change_password"
)
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
BAN_FOREVER = "876000h"  # ~100 years; Supabase has no "permanent" ban value
MIN_PASSWORD_LENGTH = 8
MAX_PASSWORD_LENGTH = 72  # bcrypt ignores everything past 72 bytes
LIST_FETCH_LIMIT = 5000


# --- Pydantic Models ---

def _clean_name(value: str) -> str:
    value = " ".join(value.split())
    if not value:
        raise ValueError("full_name cannot be empty")
    if len(value) > 200:
        raise ValueError("full_name must be 200 characters or fewer")
    return value


def _clean_email(value: str) -> str:
    value = value.strip().lower()
    if len(value) > 254 or not EMAIL_RE.match(value):
        raise ValueError("Invalid email address")
    return value


class UserCreate(BaseModel):
    full_name: str
    email: str
    role: Literal["user", "admin"] = "user"
    password: str

    @field_validator("full_name")
    @classmethod
    def _name(cls, value: str) -> str:
        return _clean_name(value)

    @field_validator("email")
    @classmethod
    def _email(cls, value: str) -> str:
        return _clean_email(value)

    @field_validator("password")
    @classmethod
    def _password(cls, value: str) -> str:
        if len(value) < MIN_PASSWORD_LENGTH:
            raise ValueError(f"Password must be at least {MIN_PASSWORD_LENGTH} characters")
        if len(value) > MAX_PASSWORD_LENGTH:
            raise ValueError(f"Password must be at most {MAX_PASSWORD_LENGTH} characters")
        return value


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None
    role: Optional[Literal["user", "admin"]] = None

    @field_validator("full_name")
    @classmethod
    def _name(cls, value: Optional[str]) -> Optional[str]:
        return None if value is None else _clean_name(value)

    @field_validator("email")
    @classmethod
    def _email(cls, value: Optional[str]) -> Optional[str]:
        return None if value is None else _clean_email(value)


# --- Helpers ---

def _public(row: dict) -> dict:
    return {
        "id": row.get("id"),
        "full_name": row.get("full_name"),
        "email": row.get("email"),
        "role": row.get("role"),
        "is_active": row.get("is_active"),
        "created_at": row.get("created_at"),
        "deactivated_at": row.get("deactivated_at"),
        "must_change_password": row.get("must_change_password"),
    }


def _label(row: dict) -> str:
    name = row.get("full_name") or ""
    email = row.get("email") or ""
    if name and email:
        return f"{name} ({email})"
    return name or email or str(row.get("id") or "")


def _fetch_user(uid: str) -> Optional[dict]:
    res = supabase.table("users").select(USER_COLUMNS).eq("id", uid).limit(1).execute()
    return res.data[0] if res and res.data else None


def _other_active_admins(exclude_id: str) -> int:
    res = (
        supabase.table("users")
        .select("id")
        .eq("role", "admin")
        .eq("is_active", True)
        .execute()
    )
    return len([r for r in (res.data or []) if r["id"] != exclude_id])


def _email_taken(email: str, exclude_id: Optional[str] = None) -> bool:
    query = supabase.table("users").select("id").eq("email", email)
    if exclude_id:
        query = query.neq("id", exclude_id)
    res = query.limit(1).execute()
    return bool(res and res.data)


def _is_duplicate_email_error(exc: Exception) -> bool:
    if getattr(exc, "code", None) == "email_exists":
        return True
    msg = str(exc).lower()
    return "already" in msg and ("registered" in msg or "exists" in msg)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _failure(admin: dict, action: str, uid: Optional[str], label: Optional[str],
             changes: Optional[dict], ip: Optional[str], exc: Exception) -> HTTPException:
    """Logs the failed attempt and returns the HTTPException to raise."""
    log_audit(
        admin, action, "user", entity_id=uid, entity_label=label,
        changes=changes, status="failed", error=error_text(exc), ip=ip,
    )
    if isinstance(exc, HTTPException):
        return exc
    return HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail=f"Operation failed: {exc}",
    )


def _raise(err: HTTPException, original: Exception):
    if err is original:
        raise err
    raise err from original


# --- Endpoints ---

@router.get("")
def list_users(
    include_inactive: bool = False,
    q: Optional[str] = None,
    _admin: dict = Depends(require_admin),
):
    """Admin-only: lists users (active only by default), sorted by full name."""
    try:
        query = supabase.table("users").select(USER_COLUMNS)
        if not include_inactive:
            query = query.eq("is_active", True)
        res = query.limit(LIST_FETCH_LIMIT).execute()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch users: {str(e)}",
        )

    rows = res.data or []
    needle = (q or "").strip().casefold()
    if needle:
        rows = [
            r for r in rows
            if needle in (r.get("full_name") or "").casefold()
            or needle in (r.get("email") or "").casefold()
        ]
    rows.sort(key=lambda r: ((r.get("full_name") or "").casefold(), (r.get("email") or "").casefold()))
    return {"users": [_public(r) for r in rows]}


@router.post("")
def create_user(payload: UserCreate, request: Request, admin: dict = Depends(require_admin)):
    """Admin-only: creates an Auth user (confirmed) plus its public.users row."""
    ip = get_client_ip(request)
    label = f"{payload.full_name} ({payload.email})"
    changes = {
        "full_name": {"from": None, "to": payload.full_name},
        "email": {"from": None, "to": payload.email},
        "role": {"from": None, "to": payload.role},
    }  # never include the password
    new_id = None
    try:
        if _email_taken(payload.email):
            raise HTTPException(status_code=409, detail="A user with this email already exists.")

        try:
            created = supabase.auth.admin.create_user({
                "email": payload.email,
                "password": payload.password,
                "email_confirm": True,
                "user_metadata": {"full_name": payload.full_name},
            })
            if not created or not created.user:
                raise RuntimeError("Supabase returned no user.")
            new_id = str(created.user.id)
        except Exception as exc:
            if _is_duplicate_email_error(exc):
                raise HTTPException(status_code=409, detail="A user with this email already exists.")
            raise HTTPException(status_code=400, detail=f"Could not create the auth account: {exc}")

        row = {
            "id": new_id,
            "full_name": payload.full_name,
            "email": payload.email,
            "role": payload.role,
            "is_active": True,
            "deactivated_at": None,
            "deactivated_by": None,
            "must_change_password": True,
        }
        try:
            res = supabase.table("users").upsert(row, on_conflict="id").execute()
            if not res.data:
                raise RuntimeError("Upsert returned no row.")
        except Exception as exc:
            # Don't leave an orphan Auth account behind.
            try:
                supabase.auth.admin.delete_user(new_id)
            except Exception as cleanup_exc:
                print(f"[LOOKit Users] Could not remove orphan auth user {new_id}: {cleanup_exc}")
            raise HTTPException(status_code=500, detail=f"Failed to save the user profile: {exc}")

        log_audit(admin, "CREATE", "user", entity_id=new_id, entity_label=label, changes=changes, ip=ip)
        return {"status": "created", "user": _public(res.data[0])}
    except Exception as exc:
        _raise(_failure(admin, "CREATE", new_id, label, changes, ip, exc), exc)


@router.put("/{user_id}")
def update_user(user_id: UUID, payload: UserUpdate, request: Request, admin: dict = Depends(require_admin)):
    """Admin-only: updates name / email / role. Auth email and name are kept in sync."""
    uid = str(user_id)
    ip = get_client_ip(request)
    label = uid
    changes = None
    try:
        before = _fetch_user(uid)
        if not before:
            raise HTTPException(status_code=404, detail="User not found.")
        label = _label(before)

        data = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
        if not data:
            raise HTTPException(status_code=400, detail="No fields provided to update.")

        new_role = data.get("role")
        if new_role and new_role != "admin":
            if uid == admin["id"]:
                raise HTTPException(status_code=400, detail="You cannot demote your own account.")
            if before.get("role") == "admin" and before.get("is_active") and _other_active_admins(uid) == 0:
                raise HTTPException(status_code=400, detail="Cannot demote the last active admin.")

        changes = diff(before, data)
        if not changes:
            return {"status": "updated", "user": _public(before)}  # nothing to change, nothing to log

        if "email" in changes and _email_taken(data["email"], exclude_id=uid):
            raise HTTPException(status_code=409, detail="A user with this email already exists.")

        # 1) Keep Supabase Auth in sync first (it is the stricter system).
        auth_attrs: dict = {}
        auth_restore: dict = {}
        if "email" in changes:
            auth_attrs["email"] = data["email"]
            auth_attrs["email_confirm"] = True
            auth_restore["email"] = before["email"]
            auth_restore["email_confirm"] = True
        if "full_name" in changes:
            auth_attrs["user_metadata"] = {"full_name": data["full_name"]}
            auth_restore["user_metadata"] = {"full_name": before.get("full_name")}
        if auth_attrs:
            try:
                supabase.auth.admin.update_user_by_id(uid, auth_attrs)
            except Exception as exc:
                if _is_duplicate_email_error(exc):
                    raise HTTPException(status_code=409, detail="A user with this email already exists.")
                raise HTTPException(status_code=400, detail=f"Could not update the auth account: {exc}")

        # 2) Update public.users; roll Auth back if this fails.
        try:
            res = (
                supabase.table("users")
                .update({k: v for k, v in data.items() if k in changes})
                .eq("id", uid)
                .execute()
            )
            if not res.data:
                raise RuntimeError("Update returned no row.")
        except Exception as exc:
            if auth_restore:
                try:
                    supabase.auth.admin.update_user_by_id(uid, auth_restore)
                except Exception as rollback_exc:
                    print(f"[LOOKit Users] Auth rollback failed for {uid}: {rollback_exc}")
            raise HTTPException(status_code=500, detail=f"Failed to update the user profile: {exc}")

        after = res.data[0]
        log_audit(admin, "UPDATE", "user", entity_id=uid, entity_label=_label(after), changes=changes, ip=ip)
        return {"status": "updated", "user": _public(after)}
    except Exception as exc:
        _raise(_failure(admin, "UPDATE", uid, label, changes, ip, exc), exc)


@router.delete("/{user_id}")
def deactivate_user(user_id: UUID, request: Request, admin: dict = Depends(require_admin)):
    """Admin-only SOFT delete: marks the user inactive and bans the Auth account. Row is kept."""
    uid = str(user_id)
    ip = get_client_ip(request)
    label = uid
    changes = {"is_active": {"from": True, "to": False}}
    try:
        before = _fetch_user(uid)
        if not before:
            raise HTTPException(status_code=404, detail="User not found.")
        label = _label(before)

        if uid == admin["id"]:
            raise HTTPException(status_code=400, detail="You cannot deactivate your own account.")
        if not before.get("is_active"):
            raise HTTPException(status_code=400, detail="This user is already deactivated.")
        if before.get("role") == "admin" and _other_active_admins(uid) == 0:
            raise HTTPException(status_code=400, detail="Cannot deactivate the last active admin.")

        # DB first: is_active is what blocks existing tokens immediately.
        res = (
            supabase.table("users")
            .update({"is_active": False, "deactivated_at": _now_iso(), "deactivated_by": admin["id"]})
            .eq("id", uid)
            .execute()
        )
        if not res.data:
            raise HTTPException(status_code=500, detail="Failed to deactivate the user.")

        try:
            supabase.auth.admin.update_user_by_id(uid, {"ban_duration": BAN_FOREVER})
        except Exception as exc:
            try:  # revert so DB and Auth never disagree
                supabase.table("users").update(
                    {"is_active": True, "deactivated_at": None, "deactivated_by": None}
                ).eq("id", uid).execute()
            except Exception as revert_exc:
                print(f"[LOOKit Users] Could not revert deactivation of {uid}: {revert_exc}")
            raise HTTPException(status_code=502, detail=f"Could not ban the account in Supabase Auth: {exc}")

        log_audit(admin, "DEACTIVATE", "user", entity_id=uid, entity_label=label, changes=changes, ip=ip)
        return {"status": "deactivated", "user": _public(res.data[0])}
    except Exception as exc:
        _raise(_failure(admin, "DEACTIVATE", uid, label, changes, ip, exc), exc)


@router.post("/{user_id}/reactivate")
def reactivate_user(user_id: UUID, request: Request, admin: dict = Depends(require_admin)):
    """Admin-only: restores a deactivated user and lifts the Auth ban."""
    uid = str(user_id)
    ip = get_client_ip(request)
    label = uid
    changes = {"is_active": {"from": False, "to": True}}
    try:
        before = _fetch_user(uid)
        if not before:
            raise HTTPException(status_code=404, detail="User not found.")
        label = _label(before)

        if before.get("is_active"):
            raise HTTPException(status_code=400, detail="This user is already active.")

        # Lift the ban first; only then let the profile become active.
        try:
            supabase.auth.admin.update_user_by_id(uid, {"ban_duration": "none"})
        except Exception as exc:
            raise HTTPException(status_code=502, detail=f"Could not lift the ban in Supabase Auth: {exc}")

        try:
            res = (
                supabase.table("users")
                .update({"is_active": True, "deactivated_at": None, "deactivated_by": None})
                .eq("id", uid)
                .execute()
            )
            if not res.data:
                raise RuntimeError("Update returned no row.")
        except Exception as exc:
            try:  # re-ban so DB and Auth never disagree
                supabase.auth.admin.update_user_by_id(uid, {"ban_duration": BAN_FOREVER})
            except Exception as revert_exc:
                print(f"[LOOKit Users] Could not re-ban {uid} after failed reactivation: {revert_exc}")
            raise HTTPException(status_code=500, detail=f"Failed to reactivate the user: {exc}")

        log_audit(admin, "REACTIVATE", "user", entity_id=uid, entity_label=label, changes=changes, ip=ip)
        return {"status": "reactivated", "user": _public(res.data[0])}
    except Exception as exc:
        _raise(_failure(admin, "REACTIVATE", uid, label, changes, ip, exc), exc)
