import re
import threading
import time
from collections import deque
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, field_validator

from database import supabase
from dependencies import get_current_user, get_current_user_profile, require_admin
from services.audit_service import (
    VALID_ACTIONS,
    VALID_ENTITY_TYPES,
    VALID_STATUSES,
    get_client_ip,
    log_audit,
)

router = APIRouter(prefix="/api/audit", tags=["Audit"])

ENTRY_COLUMNS = (
    "id, created_at, actor_email, action, entity_type, entity_id, "
    "entity_label, changes, status, error_message, ip_address"
)
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


# --- Pydantic Models ---

class LoginFailedPayload(BaseModel):
    email: str

    @field_validator("email")
    @classmethod
    def _email(cls, value: str) -> str:
        value = (value or "").strip().lower()[:254]  # truncate before validating
        if not EMAIL_RE.match(value):
            raise ValueError("Invalid email address")
        return value


# --- In-memory rate limiting for the unauthenticated endpoint ---
# NOTE: per process. With N uvicorn workers the effective limit is N x higher.

_WINDOW_SECONDS = 60
_PER_IP_MAX = 10
_GLOBAL_MAX = 200          # overall cap per window, across all IPs
_MAX_TRACKED_IPS = 5000

_ip_hits: dict = {}
_global_hits: deque = deque()
_lock = threading.Lock()


def _allow_request(ip: Optional[str]) -> bool:
    now = time.monotonic()
    cutoff = now - _WINDOW_SECONDS
    key = ip or "unknown"
    with _lock:
        while _global_hits and _global_hits[0] <= cutoff:
            _global_hits.popleft()
        if len(_global_hits) >= _GLOBAL_MAX:
            return False

        hits = _ip_hits.get(key)
        if hits is None:
            if len(_ip_hits) >= _MAX_TRACKED_IPS:
                for stale in [k for k, d in _ip_hits.items() if not d or d[-1] <= cutoff]:
                    del _ip_hits[stale]
                if len(_ip_hits) >= _MAX_TRACKED_IPS:
                    return False  # fail closed rather than grow without bound
            hits = _ip_hits[key] = deque()

        while hits and hits[0] <= cutoff:
            hits.popleft()
        if len(hits) >= _PER_IP_MAX:
            return False

        hits.append(now)
        _global_hits.append(now)
        return True


# --- Query helpers ---

def _parse_bound(value: str, name: str):
    """Returns (datetime in UTC, was_date_only). Naive values are treated as UTC."""
    raw = value.strip()
    try:
        parsed = datetime.fromisoformat(raw[:-1] + "+00:00" if raw.endswith(("Z", "z")) else raw)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"'{name}' must be an ISO date (YYYY-MM-DD) or datetime.",
        )
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc), len(raw) == 10


def _choice(value: Optional[str], allowed: tuple, name: str, upper: bool = False) -> Optional[str]:
    if not value:
        return None
    value = value.strip().upper() if upper else value.strip().lower()
    if value not in allowed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid '{name}'. Allowed values: {', '.join(allowed)}.",
        )
    return value


# --- Admin read endpoint ---

@router.get("")
def list_audit_entries(
    q: Optional[str] = Query(default=None, description="Search actor email, entity label or entity id"),
    action: Optional[str] = None,
    entity_type: Optional[str] = None,
    status_filter: Optional[str] = Query(default=None, alias="status"),
    date_from: Optional[str] = Query(default=None, description="ISO date or datetime (inclusive)"),
    date_to: Optional[str] = Query(default=None, description="ISO date (whole day) or datetime (inclusive)"),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    _admin: dict = Depends(require_admin),
):
    """Admin-only: newest-first audit entries with filters and pagination."""
    action = _choice(action, VALID_ACTIONS, "action", upper=True)
    entity_type = _choice(entity_type, VALID_ENTITY_TYPES, "entity_type")
    status_filter = _choice(status_filter, VALID_STATUSES, "status")

    try:
        query = supabase.table("audit_log").select(ENTRY_COLUMNS, count="exact")
        if action:
            query = query.eq("action", action)
        if entity_type:
            query = query.eq("entity_type", entity_type)
        if status_filter:
            query = query.eq("status", status_filter)

        if date_from:
            start, _ = _parse_bound(date_from, "date_from")
            query = query.gte("created_at", start.isoformat())
        if date_to:
            end, date_only = _parse_bound(date_to, "date_to")
            if date_only:
                query = query.lt("created_at", (end + timedelta(days=1)).isoformat())
            else:
                query = query.lte("created_at", end.isoformat())

        # Strip characters that would break PostgREST's or() syntax / wildcard handling.
        needle = re.sub(r'[,()"\\*%]', " ", q or "").strip()
        if needle:
            query = query.or_(
                f"actor_email.ilike.*{needle}*,entity_label.ilike.*{needle}*,entity_id.ilike.*{needle}*"
            )

        res = (
            query.order("created_at", desc=True)
            .order("id", desc=True)
            .range(offset, offset + limit - 1)
            .execute()
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch audit log: {str(e)}",
        )

    entries = res.data or []
    total = res.count if getattr(res, "count", None) is not None else len(entries)
    return {"entries": entries, "total": total}


# --- Client-reported auth events ---

@router.post("/login")
def audit_login(request: Request, profile: dict = Depends(get_current_user_profile)):
    """Any signed-in user: records a successful login (frontend calls this after sign-in)."""
    log_audit(
        profile, "LOGIN", "auth",
        entity_id=profile.get("id"), entity_label=profile.get("email"),
        ip=get_client_ip(request),
    )
    return {"status": "logged"}


@router.post("/logout")
def audit_logout(request: Request, user: dict = Depends(get_current_user)):
    """Any valid token: records a logout (frontend calls this before signing out)."""
    log_audit(
        user, "LOGOUT", "auth",
        entity_id=user.get("id"), entity_label=user.get("email"),
        ip=get_client_ip(request),
    )
    return {"status": "logged"}


@router.post("/login-failed")
def audit_login_failed(payload: LoginFailedPayload, request: Request):
    """
    Unauthenticated: records a failed sign-in attempt for the given email.
    Always answers the same way whether or not the email belongs to an account.
    """
    ip = get_client_ip(request)
    if not _allow_request(ip):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many requests. Please try again later.",
            headers={"Retry-After": str(_WINDOW_SECONDS)},
        )
    log_audit(
        {"email": payload.email}, "LOGIN_FAILED", "auth",
        entity_label=payload.email, status="failed",
        error="Sign-in failed", ip=ip,
    )
    return {"status": "logged"}
