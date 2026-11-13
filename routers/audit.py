import csv
import io
import re
import threading
import time
from collections import deque
from datetime import datetime, timedelta, timezone, date
from typing import Optional
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import StreamingResponse
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

# --------------------------------------------------
# PYDANTIC MODELS
# --------------------------------------------------

class LoginFailedPayload(BaseModel):
    email: str

    @field_validator("email")
    @classmethod
    def _email(cls, value: str) -> str:
        value = (value or "").strip().lower()[:254]
        if not EMAIL_RE.match(value):
            raise ValueError("Invalid email address")
        return value

# --------------------------------------------------
# IN-MEMORY RATE LIMITING
# --------------------------------------------------

_WINDOW_SECONDS = 60
_PER_IP_MAX = 10
_GLOBAL_MAX = 200
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
                for stale in [
                    k for k, d in _ip_hits.items()
                    if not d or d[-1] <= cutoff
                ]:
                    del _ip_hits[stale]

                if len(_ip_hits) >= _MAX_TRACKED_IPS:
                    return False

            hits = _ip_hits[key] = deque()

        while hits and hits[0] <= cutoff:
            hits.popleft()

        if len(hits) >= _PER_IP_MAX:
            return False

        hits.append(now)
        _global_hits.append(now)
        return True

# --------------------------------------------------
# QUERY HELPERS
# --------------------------------------------------

def _parse_bound(value: str, name: str):
    """Returns (UTC datetime, was_date_only)."""
    raw = value.strip()

    try:
        parsed = datetime.fromisoformat(
            raw[:-1] + "+00:00"
            if raw.endswith(("Z", "z"))
            else raw
        )
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"'{name}' must be an ISO date or datetime.",
        )

    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)

    return parsed.astimezone(timezone.utc), len(raw) == 10


def _choice(
    value: Optional[str],
    allowed: tuple,
    name: str,
    upper: bool = False,
):
    if not value:
        return None

    value = value.strip().upper() if upper else value.strip().lower()

    if value not in allowed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid '{name}'. Allowed values: {', '.join(allowed)}.",
        )

    return value

# --------------------------------------------------
# AUDIT SEARCH
# --------------------------------------------------

MONTHS = {
    "january": 1,
    "february": 2,
    "march": 3,
    "april": 4,
    "may": 5,
    "june": 6,
    "july": 7,
    "august": 8,
    "september": 9,
    "october": 10,
    "november": 11,
    "december": 12,
}


def _month_number(value):
    """Recognize full or abbreviated month names."""
    keyword = value.strip().lower()

    if not keyword:
        return None

    for name, number in MONTHS.items():
        if name.startswith(keyword):
            return number

    return None


def _date_search_ranges(raw):

    manila = ZoneInfo("Asia/Manila")
    utc = timezone.utc
    raw = (raw or "").strip()
    ranges = []

    if not raw:
        return ranges

    today = datetime.now(manila).date()
    current_year = today.year

    def add_range(start, end):
        ranges.append((
            start.astimezone(utc),
            end.astimezone(utc),
        ))

    def add_day(year, month, day):
        try:
            start = datetime(
                year, month, day, tzinfo=manila
            )
            add_range(start, start + timedelta(days=1))
        except ValueError:
            pass

    # MONTH SEARCH
    month = _month_number(raw)

    if month:
        for year in range(current_year - 5, current_year + 2):
            start = datetime(
                year, month, 1, tzinfo=manila
            )

            if month == 12:
                end = datetime(
                    year + 1, 1, 1, tzinfo=manila
                )
            else:
                end = datetime(
                    year, month + 1, 1,
                    tzinfo=manila
                )

            add_range(start, end)

        return ranges

    # YEAR SEARCH
    if re.fullmatch(r"\d{4}", raw):
        year = int(raw)

        if 1 <= year <= 9998:
            start = datetime(
                year, 1, 1, tzinfo=manila
            )
            end = datetime(
                year + 1, 1, 1, tzinfo=manila
            )
            add_range(start, end)

        return ranges

    # MONTH + DAY SEARCH
    match = re.fullmatch(
        r"([A-Za-z]+)\s+(\d{1,2})",
        raw
    )

    if match:
        month = _month_number(match.group(1))
        day = int(match.group(2))

        if month:
            for year in range(
                current_year - 5,
                current_year + 2
            ):
                add_day(year, month, day)

            return ranges

    # COMPLETE DATE SEARCH
    for fmt in (
        "%Y-%m-%d",
        "%m/%d/%Y",
        "%Y/%m/%d",
        "%b %d, %Y",
        "%B %d, %Y",
        "%b %d %Y",
        "%B %d %Y",
    ):
        try:
            parsed = datetime.strptime(raw, fmt)
            add_day(
                parsed.year,
                parsed.month,
                parsed.day
            )
            return ranges
        except ValueError:
            continue


    match = re.fullmatch(
        r"(?i)(\d{1,2}):(\d{0,2})"
        r"(?::(\d{0,2}))?\s*(am|pm)?",
        raw
    )

    if match:
        hour = int(match.group(1))
        minute_text = match.group(2)
        second_text = match.group(3)
        meridiem = (match.group(4) or "").lower()

        if meridiem and not (1 <= hour <= 12):
            return ranges

        if not meridiem and hour > 23:
            return ranges

        if minute_text and int(minute_text) > 59:
            return ranges

        if second_text and int(second_text) > 59:
            return ranges

        hours = []

        if meridiem:
            converted = hour % 12
            if meridiem == "pm":
                converted += 12
            hours = [converted]
        elif hour == 0 or hour > 12:
            hours = [hour]
        elif hour == 12:
            hours = [0, 12]
        else:
            hours = [hour, hour + 12]

        def get_parts(text, maximum):
            if not text:
                return [(0, maximum)]

            if len(text) == 1:
                prefix = int(text)
                return [
                    (prefix * 10, prefix * 10 + 9)
                ]

            value = int(text)
            return [(value, value)]

        minute_ranges = get_parts(minute_text, 59)

        if second_text is None:
            second_ranges = [(0, 59)]
        else:
            second_ranges = get_parts(second_text, 59)

        # Search matching times across the last 31 days.
        for days_back in range(31):
            day = today - timedelta(days=days_back)

            for h in hours:
                for min_start, min_end in minute_ranges:
                    for sec_start, sec_end in second_ranges:
                        try:
                            start = datetime(
                                day.year,
                                day.month,
                                day.day,
                                h,
                                min_start,
                                sec_start,
                                tzinfo=manila,
                            )

                            end = datetime(
                                day.year,
                                day.month,
                                day.day,
                                h,
                                min_end,
                                sec_end,
                                tzinfo=manila,
                            ) + timedelta(seconds=1)

                            add_range(start, end)
                        except ValueError:
                            continue

        return ranges

    return ranges


def apply_audit_search(query, q):
    raw = (q or "").strip()

    if not raw:
        return query

    needle = re.sub(
        r'[,()"\\*%]',
        " ",
        raw
    ).strip()

    clauses = []

    if needle:
        clauses = [
            f"actor_email.ilike.*{needle}*",
            f"entity_label.ilike.*{needle}*",
            f"entity_id.ilike.*{needle}*",
            f"action.ilike.*{needle}*",
            f"entity_type.ilike.*{needle}*",
            f"status.ilike.*{needle}*",
            f"error_message.ilike.*{needle}*",
        ]

        if needle.lower() == "failed":
            clauses.append("status.ilike.*fail*")

    date_ranges = _date_search_ranges(raw)

    for start, end in date_ranges:
        clauses.append(
            "and("
            f"created_at.gte.{start.isoformat()},"
            f"created_at.lt.{end.isoformat()}"
            ")"
        )

    if not clauses:
        return query

    return query.or_(",".join(clauses))


def apply_audit_filters(
    query,
    q=None,
    action=None,
    entity_type=None,
    status_filter=None,
    date_from=None,
    date_to=None,
):

    action = _choice(
        action, VALID_ACTIONS, "action", upper=True
    )

    entity_type = _choice(
        entity_type, VALID_ENTITY_TYPES, "entity_type"
    )

    status_filter = _choice(
        status_filter, VALID_STATUSES, "status"
    )

    if action:
        query = query.eq("action", action)

    if entity_type:
        query = query.eq("entity_type", entity_type)

    if status_filter:
        query = query.eq("status", status_filter)

    if date_from:
        start, _ = _parse_bound(date_from, "date_from")
        query = query.gte(
            "created_at", start.isoformat()
        )

    if date_to:
        end, date_only = _parse_bound(
            date_to, "date_to"
        )

        if date_only:
            query = query.lt(
                "created_at",
                (end + timedelta(days=1)).isoformat()
            )
        else:
            query = query.lte(
                "created_at",
                end.isoformat()
            )

    return apply_audit_search(query, q)

# --------------------------------------------------
# ADMIN READ ENDPOINT
# --------------------------------------------------

@router.get("")
def list_audit_entries(
    q: Optional[str] = Query(default=None),
    action: Optional[str] = None,
    entity_type: Optional[str] = None,
    status_filter: Optional[str] = Query(
        default=None, alias="status"
    ),
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    _admin: dict = Depends(require_admin),
):

    try:
        query = supabase.table("audit_log").select(
            ENTRY_COLUMNS,
            count="exact"
        )

        query = apply_audit_filters(
            query,
            q=q,
            action=action,
            entity_type=entity_type,
            status_filter=status_filter,
            date_from=date_from,
            date_to=date_to,
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

    total = (
        res.count
        if getattr(res, "count", None) is not None
        else len(entries)
    )

    return {
        "entries": entries,
        "total": total
    }

# --------------------------------------------------
# EXPORT AUDIT LOGS
# --------------------------------------------------

@router.get("/export")
def export_audit_logs(
    q: Optional[str] = Query(default=None),
    action: Optional[str] = None,
    entity_type: Optional[str] = None,
    status_filter: Optional[str] = Query(
        default=None, alias="status"
    ),
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    _admin: dict = Depends(require_admin),
):

    try:
        query = supabase.table("audit_log").select(
            ENTRY_COLUMNS
        )

        query = apply_audit_filters(
            query,
            q=q,
            action=action,
            entity_type=entity_type,
            status_filter=status_filter,
            date_from=date_from,
            date_to=date_to,
        )

        res = (
            query.order("created_at", desc=True)
            .limit(10000)
            .execute()
        )

    except HTTPException:
        raise

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Export failed: {str(e)}",
        )

    entries = res.data or []

    output = io.StringIO()
    writer = csv.writer(output)

    writer.writerow([
        "Date",
        "Time",
        "Actor Email",
        "Action",
        "Entity Type",
        "Entity Label",
        "Status",
        "Error Message",
        "IP Address",
    ])

    for e in entries:
        dt = datetime.fromisoformat(
            e["created_at"].replace("Z", "+00:00")
        )

        writer.writerow([
            dt.strftime("%Y-%m-%d"),
            dt.strftime("%H:%M:%S"),
            e.get("actor_email") or "",
            e.get("action") or "",
            e.get("entity_type") or "",
            e.get("entity_label") or "",
            e.get("status") or "",
            e.get("error_message") or "",
            e.get("ip_address") or "",
        ])

    output.seek(0)

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={
            "Content-Disposition":
            "attachment; filename=lookit_audit_logs.csv"
        },
    )

# --------------------------------------------------
# CLIENT-REPORTED AUTH EVENTS
# --------------------------------------------------

@router.post("/login")
def audit_login(
    request: Request,
    profile: dict = Depends(get_current_user_profile),
):
    """Record a successful login."""

    log_audit(
        profile,
        "LOGIN",
        "auth",
        entity_id=profile.get("id"),
        entity_label=profile.get("email"),
        ip=get_client_ip(request),
    )

    return {"status": "logged"}


@router.post("/logout")
def audit_logout(
    request: Request,
    user: dict = Depends(get_current_user),
):

    log_audit(
        user,
        "LOGOUT",
        "auth",
        entity_id=user.get("id"),
        entity_label=user.get("email"),
        ip=get_client_ip(request),
    )

    return {"status": "logged"}


@router.post("/login-failed")
def audit_login_failed(
    payload: LoginFailedPayload,
    request: Request,
):
    """Record failed login attempts with rate limiting."""

    ip = get_client_ip(request)

    if not _allow_request(ip):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many requests. Please try again later.",
            headers={
                "Retry-After": str(_WINDOW_SECONDS)
            },
        )

    log_audit(
        {"email": payload.email},
        "LOGIN_FAILED",
        "auth",
        entity_label=payload.email,
        status="failed",
        error="Sign-in failed",
        ip=ip,
    )

    return {"status": "logged"}