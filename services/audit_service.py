"""
Audit logging helpers for LOOKit.

log_audit() NEVER raises: a failed audit write must not break the real operation.
"""
import json
import os
import uuid
from typing import Any, Optional

from fastapi import Request

from database import supabase

VALID_ACTIONS = (
    "LOGIN", "LOGIN_FAILED", "LOGOUT",
    "CREATE", "UPDATE", "DEACTIVATE", "REACTIVATE", "DELETE",
)
VALID_ENTITY_TYPES = ("auth", "user", "staff", "location")
VALID_STATUSES = ("success", "failed")

# How many reverse proxies sit in front of this API and append to X-Forwarded-For.
#   0 (default) -> ignore X-Forwarded-For entirely and use the socket address
#                  (correct when the API is exposed directly; header can't be spoofed).
#   1           -> e.g. Render / Railway / Fly / Nginx: trust the last hop's entry.
#   2           -> e.g. Cloudflare in front of Render.
try:
    TRUSTED_PROXY_COUNT = max(int(os.getenv("TRUSTED_PROXY_COUNT", "0") or 0), 0)
except ValueError:
    TRUSTED_PROXY_COUNT = 0


def _clip(value: Any, limit: int) -> Optional[str]:
    if value is None:
        return None
    return str(value)[:limit]


def _as_uuid(value: Any) -> Optional[str]:
    if not value:
        return None
    try:
        return str(uuid.UUID(str(value)))
    except (ValueError, AttributeError, TypeError):
        return None


def _jsonable(value: Any) -> Any:
    """Round-trips through JSON so datetimes etc. become strings."""
    if value is None:
        return None
    return json.loads(json.dumps(value, default=str))


def get_client_ip(request: Optional[Request]) -> Optional[str]:
    """Best-effort client IP. Only trusts X-Forwarded-For when TRUSTED_PROXY_COUNT > 0."""
    if request is None:
        return None
    try:
        if TRUSTED_PROXY_COUNT > 0:
            forwarded = request.headers.get("x-forwarded-for")
            if forwarded:
                parts = [p.strip() for p in forwarded.split(",") if p.strip()]
                if parts:
                    # The entry appended by our outermost trusted proxy is N from the right.
                    index = max(len(parts) - TRUSTED_PROXY_COUNT, 0)
                    return _clip(parts[index], 64)
        return _clip(request.client.host, 64) if request.client else None
    except Exception:
        return None


def error_text(exc: Exception) -> str:
    """Readable message for an exception (uses HTTPException.detail when present)."""
    detail = getattr(exc, "detail", None)
    return str(detail) if detail else str(exc)


def diff(before: Optional[dict], after: Optional[dict]) -> dict:
    """Returns {field: {"from": old, "to": new}} for fields in `after` whose value changed."""
    before = before or {}
    after = after or {}
    return {
        key: {"from": before.get(key), "to": value}
        for key, value in after.items()
        if before.get(key) != value
    }


def log_audit(
    actor: Optional[dict],
    action: str,
    entity_type: str,
    entity_id: Any = None,
    entity_label: Optional[str] = None,
    changes: Optional[dict] = None,
    status: str = "success",
    error: Any = None,
    ip: Optional[str] = None,
) -> None:
    """
    Inserts one row into public.audit_log. Never raises.

    `actor` is any dict with optional "id" and "email" (a profile from require_admin,
    the dict from get_current_user, or {"email": attempted_email} for failed logins).
    """
    try:
        actor = actor or {}
        row = {
            "actor_id": _as_uuid(actor.get("id")),
            "actor_email": _clip(actor.get("email"), 320),
            "action": action,
            "entity_type": entity_type,
            "entity_id": _clip(entity_id, 100),
            "entity_label": _clip(entity_label, 255),
            "changes": _jsonable(changes),
            "status": status,
            "error_message": _clip(error, 1000),
            "ip_address": _clip(ip, 64),
        }
        supabase.table("audit_log").insert(row).execute()
    except Exception as exc:  # noqa: BLE001 - audit must never break the caller
        print(f"[LOOKit Audit] Failed to write audit entry ({action} {entity_type}): {exc}")
