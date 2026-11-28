import re
from datetime import datetime, timezone
from typing import Literal, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, field_validator
from database import supabase
from dependencies import require_admin
from services.audit_service import diff, error_text, get_client_ip, log_audit
from services.rate_limit_service import rate_limit
from services.validation_service import validate_strong_password

router = APIRouter(prefix="/api/users", tags=["Users"])

USER_COLUMNS = (
    "id, full_name, email, role, is_active, created_at, "
    "deactivated_at, deactivated_by, must_change_password"
)
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
BAN_FOREVER = "876000h"
MAX_PASSWORD_LENGTH = 72
LIST_FETCH_LIMIT = 5000


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
        if len(value) > MAX_PASSWORD_LENGTH:
            raise ValueError(f"Password must be at most {MAX_PASSWORD_LENGTH} characters")
        return validate_strong_password(value)


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
    res = supabase.table("users").select("id").eq("role", "admin").eq("is_active", True).execute()
    return len([r for r in (res.data or []) if r["id"] != exclude_id])


def _email_taken(email: str, exclude_id: Optional[str] = None) -> bool:
    escaped = email.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    query = supabase.table("users").select("id").ilike("email", escaped)
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


def _failure(
    admin: dict,
    action: str,
    uid: Optional[str],
    label: Optional[str],
    changes: Optional[dict],
    ip: Optional[str],
    exc: Exception,
) -> HTTPException:
    log_audit(
        admin, action, "user", entity_id=uid, entity_label=label,
        changes=changes, status="failed", error=error_text(exc), ip=ip,
    )
    if isinstance(exc, HTTPException):
        return exc
    print(f"[LOOKit Users] {action} failed for {uid}: {exc}")
    return HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="Operation failed. Please try again.",
    )


def _raise(err: HTTPException, original: Exception):
    if err is original:
        raise err
    raise err from original


@router.get(
    "",
    dependencies=[Depends(rate_limit(limit=60, window_seconds=60, scope="users_list"))],
)
def list_users(
    include_inactive: bool = False,
    q: Optional[str] = Query(default=None, max_length=100),
    _admin: dict = Depends(require_admin),
):
    try:
        query = supabase.table("users").select(USER_COLUMNS)
        if not include_inactive:
            query = query.eq("is_active", True)
        res = query.order("full_name").limit(LIST_FETCH_LIMIT).execute()
    except Exception as exc:
        print(f"[LOOKit Users] Failed to fetch users: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to load users.",
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


@router.post(
    "",
    dependencies=[Depends(rate_limit(limit=20, window_seconds=60, scope="users_write"))],
)
def create_user(payload: UserCreate, request: Request, admin: dict = Depends(require_admin)):
    ip = get_client_ip(request)
    label = f"{payload.full_name} ({payload.email})"
    changes = {
        "full_name": {"from": None, "to": payload.full_name},
        "email": {"from": None, "to": payload.email},
        "role": {"from": None, "to": payload.role},
    }
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
            print(f"[LOOKit Users] Auth create_user failed: {exc}")
            raise HTTPException(status_code=400, detail="Could not create the authentication account.")

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
            print(f"[LOOKit Users] Profile upsert failed for {new_id}: {exc}")
            try:
                supabase.auth.admin.delete_user(new_id)
            except Exception as cleanup_exc:
                print(f"[LOOKit Users] Could not remove orphan auth user {new_id}: {cleanup_exc}")
            raise HTTPException(status_code=500, detail="Failed to save the user profile.")

        log_audit(admin, "CREATE", "user", entity_id=new_id, entity_label=label, changes=changes, ip=ip)
        return {"status": "created", "user": _public(res.data[0])}
    except Exception as exc:
        _raise(_failure(admin, "CREATE", new_id, label, changes, ip, exc), exc)


@router.put(
    "/{user_id}",
    dependencies=[Depends(rate_limit(limit=30, window_seconds=60, scope="users_write"))],
)
def update_user(user_id: UUID, payload: UserUpdate, request: Request, admin: dict = Depends(require_admin)):
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
            return {"status": "updated", "user": _public(before)}

        if "email" in changes and _email_taken(data["email"], exclude_id=uid):
            raise HTTPException(status_code=409, detail="A user with this email already exists.")

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
                print(f"[LOOKit Users] Auth update failed for {uid}: {exc}")
                raise HTTPException(status_code=400, detail="Could not update the authentication account.")

        try:
            res = supabase.table("users").update({k: v for k, v in data.items() if k in changes}).eq("id", uid).execute()
            if not res.data:
                raise RuntimeError("Update returned no row.")
        except Exception as exc:
            print(f"[LOOKit Users] Profile update failed for {uid}: {exc}")
            if auth_restore:
                try:
                    supabase.auth.admin.update_user_by_id(uid, auth_restore)
                except Exception as rollback_exc:
                    print(f"[LOOKit Users] Auth rollback failed for {uid}: {rollback_exc}")
            raise HTTPException(status_code=500, detail="Failed to update the user profile.")

        after = res.data[0]
        log_audit(admin, "UPDATE", "user", entity_id=uid, entity_label=_label(after), changes=changes, ip=ip)
        return {"status": "updated", "user": _public(after)}
    except Exception as exc:
        _raise(_failure(admin, "UPDATE", uid, label, changes, ip, exc), exc)


@router.delete(
    "/{user_id}",
    dependencies=[Depends(rate_limit(limit=20, window_seconds=60, scope="users_write"))],
)
def deactivate_user(user_id: UUID, request: Request, admin: dict = Depends(require_admin)):
    """Admin-only SOFT delete: archives the user, marks inactive, and bans the Auth account."""
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

        archive_payload = {
            "original_user_id": uid,
            "full_name": before.get("full_name"),
            "email": before.get("email"),
            "role": before.get("role"),
            "archived_by": admin["id"],
        }
        try:
            supabase.table("archived_users").insert(archive_payload).execute()
        except Exception as archive_exc:
            print(f"[LOOKit Users] Failed to archive user {uid}: {archive_exc}")
            raise HTTPException(status_code=500, detail="Failed to archive user data before deactivation.")

        res = supabase.table("users").update({
            "is_active": False,
            "deactivated_at": _now_iso(),
            "deactivated_by": admin["id"],
        }).eq("id", uid).execute()
        if not res.data:
            raise HTTPException(status_code=500, detail="Failed to deactivate the user.")

        try:
            supabase.auth.admin.update_user_by_id(uid, {"ban_duration": BAN_FOREVER})
        except Exception as exc:
            print(f"[LOOKit Users] Auth ban failed for {uid}: {exc}")
            try:
                supabase.table("users").update({
                    "is_active": True,
                    "deactivated_at": None,
                    "deactivated_by": None,
                }).eq("id", uid).execute()
            except Exception as revert_exc:
                print(f"[LOOKit Users] Could not revert deactivation of {uid}: {revert_exc}")
            raise HTTPException(status_code=502, detail="Could not suspend the authentication account.")

        log_audit(admin, "DEACTIVATE", "user", entity_id=uid, entity_label=label, changes=changes, ip=ip)
        return {"status": "deactivated", "user": _public(res.data[0])}
    except Exception as exc:
        _raise(_failure(admin, "DEACTIVATE", uid, label, changes, ip, exc), exc)


@router.post(
    "/{user_id}/reactivate",
    dependencies=[Depends(rate_limit(limit=20, window_seconds=60, scope="users_write"))],
)
def reactivate_user(user_id: UUID, request: Request, admin: dict = Depends(require_admin)):
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

        try:
            supabase.auth.admin.update_user_by_id(uid, {"ban_duration": "none"})
        except Exception as exc:
            print(f"[LOOKit Users] Auth unban failed for {uid}: {exc}")
            raise HTTPException(status_code=502, detail="Could not restore the authentication account.")

        try:
            res = supabase.table("users").update({
                "is_active": True,
                "deactivated_at": None,
                "deactivated_by": None,
            }).eq("id", uid).execute()
            if not res.data:
                raise RuntimeError("Update returned no row.")
        except Exception as exc:
            print(f"[LOOKit Users] Profile reactivation failed for {uid}: {exc}")
            try:
                supabase.auth.admin.update_user_by_id(uid, {"ban_duration": BAN_FOREVER})
            except Exception as revert_exc:
                print(f"[LOOKit Users] Could not re-ban {uid} after failed reactivation: {revert_exc}")
            raise HTTPException(status_code=500, detail="Failed to reactivate the user.")

        log_audit(admin, "REACTIVATE", "user", entity_id=uid, entity_label=label, changes=changes, ip=ip)
        return {"status": "reactivated", "user": _public(res.data[0])}
    except Exception as exc:
        _raise(_failure(admin, "REACTIVATE", uid, label, changes, ip, exc), exc)