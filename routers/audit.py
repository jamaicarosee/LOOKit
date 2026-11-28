import csv
import io
import re
from datetime import datetime, timedelta, timezone
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
from services.rate_limit_service import SlidingWindowLimiter, rate_limit

router = APIRouter(prefix="/api/audit", tags=["Audit"])

ENTRY_COLUMNS = (
    "id, created_at, actor_email, action, entity_type, entity_id, "
    "entity_label, changes, status, error_message, ip_address"
)

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
_CSV_FORMULA_PREFIXES = ("=", "+", "-", "@", "\t", "\r")

EXPORT_MAX_ROWS = 10000
EXPORT_BATCH_SIZE = 1000
MAX_DATE_RANGE_CLAUSES = 14

# Shared bounded limiters for /login-failed (per-IP + global cap)
_login_failed_ip_limiter = SlidingWindowLimiter(limit=10, window_seconds=60, max_keys=5000)
_login_failed_global_limiter = SlidingWindowLimiter(limit=200, window_seconds=60, max_keys=1)


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
# CSV FORMULA INJECTION SANITIZER
# --------------------------------------------------

def _csv_safe(value) -> str:
    """Neutralizes Excel/Calc formula injection by prefixing dangerous leading chars."""
    text = "" if value is None else str(value)
    stripped = text.lstrip(" ")
    if stripped and stripped[0] in _CSV_FORMULA_PREFIXES:
        return "'" + text
    return text


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
    "january": 1, "february": 2, "march": 3, "april": 4,
    "may": 5, "june": 6, "july": 7, "august": 8,
    "september": 9, "october": 10, "november": 11, "december": 12,
}


def _month_number(value):
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
        if len(ranges) < MAX_DATE_RANGE_CLAUSES:
            ranges.append((start.astimezone(utc), end.astimezone(utc)))

    def add_day(year, month, day):
        try:
            start = datetime(year, month, day, tzinfo=manila)
            add_range(start, start + timedelta(days=1))
        except ValueError:
            pass

    # MONTH SEARCH
    month = _month_number(raw)
    if month:
        for year in range(current_year - 5, current_year + 2):
            start = datetime(year, month, 1, tzinfo=manila)
            end = datetime(year + 1, 1, 1, tzinfo=manila) if month == 12 else datetime(year, month + 1, 1, tzinfo=manila)
            add_range(start, end)
        return ranges

    # YEAR SEARCH
    if re.fullmatch(r"\d{4}", raw):
        year = int(raw)
        if 1 <= year <= 9998:
            add_range(datetime(year, 1, 1, tzinfo=manila), datetime(year + 1, 1, 1, tzinfo=manila))
        return ranges

    # MONTH + DAY SEARCH
    match = re.fullmatch(r"([A-Za-z]+)\s+(\d{1,2})", raw)
    if match:
        month = _month_number(match.group(1))
        day = int(match.group(2))
        if month:
            for year in range(current_year - 5, current_year + 2):
                add_day(year, month, day)
            return ranges

    # COMPLETE DATE SEARCH
    for fmt in (
        "%Y-%m-%d", "%m/%d/%Y", "%Y/%m/%d",
        "%b %d, %Y", "%B %d, %Y", "%b %d %Y", "%B %d %Y",
    ):
        try:
            parsed = datetime.strptime(raw, fmt)
            add_day(parsed.year, parsed.month, parsed.day)
            return ranges
        except ValueError:
            continue

    # TIME SEARCH (bounded to last 7 days / MAX_DATE_RANGE_CLAUSES to prevent URI bloat)
    match = re.fullmatch(r"(?i)(\d{1,2}):(\d{0,2})(?::(\d{0,2}))?\s*(am|pm)?", raw)
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
                return [(prefix * 10, prefix * 10 + 9)]
            val = int(text)
            return [(val, val)]

        minute_ranges = get_parts(minute_text, 59)
        second_ranges = [(0, 59)] if second_text is None else get_parts(second_text, 59)

        for days_back in range(7):
            if len(ranges) >= MAX_DATE_RANGE_CLAUSES:
                break
            day = today - timedelta(days=days_back)
            for h in hours:
                for min_start, min_end in minute_ranges:
                    for sec_start, sec_end in second_ranges:
                        if len(ranges) >= MAX_DATE_RANGE_CLAUSES:
                            break
                        try:
                            start = datetime(day.year, day.month, day.day, h, min_start, sec_start, tzinfo=manila)
                            end = datetime(day.year, day.month, day.day, h, min_end, sec_end, tzinfo=manila) + timedelta(seconds=1)
                            add_range(start, end)
                        except ValueError:
                            continue

    return ranges


def apply_audit_search(query, q):
    raw = (q or "").strip()[:100]
    if not raw:
        return query

    needle = re.sub(r'[,()"\\*%.]', " ", raw).strip()
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

    for start, end in _date_search_ranges(raw):
        clauses.append(
            f"and(created_at.gte.{start.isoformat()},created_at.lt.{end.isoformat()})"
        )

    if not clauses:
        return query

    return query.or_(",".join(clauses))


def _validate_audit_filters(
    action=None,
    entity_type=None,
    status_filter=None,
    date_from=None,
    date_to=None,
):
    validated = {
        "action": _choice(action, VALID_ACTIONS, "action", upper=True),
        "entity_type": _choice(entity_type, VALID_ENTITY_TYPES, "entity_type"),
        "status_filter": _choice(status_filter, VALID_STATUSES, "status"),
        "date_from": _parse_bound(date_from, "date_from") if date_from else None,
        "date_to": _parse_bound(date_to, "date_to") if date_to else None,
    }
    return validated


def _apply_validated_filters(query, validated: dict, q=None):
    if validated["action"]:
        query = query.eq("action", validated["action"])
    if validated["entity_type"]:
        query = query.eq("entity_type", validated["entity_type"])
    if validated["status_filter"]:
        query = query.eq("status", validated["status_filter"])
    if validated["date_from"]:
        start, _ = validated["date_from"]
        query = query.gte("created_at", start.isoformat())
    if validated["date_to"]:
        end, date_only = validated["date_to"]
        if date_only:
            query = query.lt("created_at", (end + timedelta(days=1)).isoformat())
        else:
            query = query.lte("created_at", end.isoformat())
    return apply_audit_search(query, q)


# --------------------------------------------------
# ADMIN READ ENDPOINT
# --------------------------------------------------

@router.get(
    "",
    dependencies=[Depends(rate_limit(limit=60, window_seconds=60, scope="audit_list"))],
)
def list_audit_entries(
    q: Optional[str] = Query(default=None, max_length=100),
    action: Optional[str] = None,
    entity_type: Optional[str] = None,
    status_filter: Optional[str] = Query(default=None, alias="status"),
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0, le=50000),
    _admin: dict = Depends(require_admin),
):
    validated = _validate_audit_filters(action, entity_type, status_filter, date_from, date_to)

    try:
        query = supabase.table("audit_log").select(ENTRY_COLUMNS, count="exact")
        query = _apply_validated_filters(query, validated, q=q)
        res = (
            query.order("created_at", desc=True)
            .order("id", desc=True)
            .range(offset, offset + limit - 1)
            .execute()
        )
    except HTTPException:
        raise
    except Exception as exc:
        print(f"[LOOKit Audit] Failed to fetch audit log: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to load audit log.",
        )

    entries = res.data or []
    total = res.count if getattr(res, "count", None) is not None else len(entries)
    return {"entries": entries, "total": total}


# --------------------------------------------------
# EXPORT AUDIT LOGS (STREAMED & FORMULA-SAFE)
# --------------------------------------------------

@router.get(
    "/export",
    dependencies=[Depends(rate_limit(limit=5, window_seconds=60, scope="audit_export"))],
)
def export_audit_logs(
    q: Optional[str] = Query(default=None, max_length=100),
    action: Optional[str] = None,
    entity_type: Optional[str] = None,
    status_filter: Optional[str] = Query(default=None, alias="status"),
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    _admin: dict = Depends(require_admin),
):
    # Validate all filters up front so invalid params return HTTP 400 before streaming starts
    validated = _validate_audit_filters(action, entity_type, status_filter, date_from, date_to)

    def _csv_stream():
        buf = io.StringIO()
        writer = csv.writer(buf)
        writer.writerow([
            "Date", "Time", "Actor Email", "Action",
            "Entity Type", "Entity Label", "Status",
            "Error Message", "IP Address",
        ])
        yield buf.getvalue()

        offset = 0
        while offset < EXPORT_MAX_ROWS:
            end_idx = min(offset + EXPORT_BATCH_SIZE - 1, EXPORT_MAX_ROWS - 1)
            query = supabase.table("audit_log").select(ENTRY_COLUMNS)
            query = _apply_validated_filters(query, validated, q=q)
            res = (
                query.order("created_at", desc=True)
                .order("id", desc=True)
                .range(offset, end_idx)
                .execute()
            )
            batch = res.data or []
            if not batch:
                break

            buf = io.StringIO()
            writer = csv.writer(buf)
            for e in batch:
                dt = datetime.fromisoformat(e["created_at"].replace("Z", "+00:00"))
                writer.writerow([
                    dt.strftime("%Y-%m-%d"),
                    dt.strftime("%H:%M:%S"),
                    _csv_safe(e.get("actor_email")),
                    _csv_safe(e.get("action")),
                    _csv_safe(e.get("entity_type")),
                    _csv_safe(e.get("entity_label")),
                    _csv_safe(e.get("status")),
                    _csv_safe(e.get("error_message")),
                    _csv_safe(e.get("ip_address")),
                ])
            yield buf.getvalue()

            if len(batch) < EXPORT_BATCH_SIZE:
                break
            offset += EXPORT_BATCH_SIZE

    return StreamingResponse(
        _csv_stream(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=lookit_audit_logs.csv"},
    )


# --------------------------------------------------
# CLIENT-REPORTED AUTH EVENTS
# --------------------------------------------------

@router.post(
    "/login",
    dependencies=[Depends(rate_limit(limit=20, window_seconds=60, scope="audit_login"))],
)
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


@router.post(
    "/logout",
    dependencies=[Depends(rate_limit(limit=20, window_seconds=60, scope="audit_logout"))],
)
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
    """Record failed login attempts with per-IP and global rate limiting."""
    ip = get_client_ip(request) or "unknown"

    global_ok, global_retry = _login_failed_global_limiter.hit("global")
    ip_ok, ip_retry = _login_failed_ip_limiter.hit(ip)
    if not global_ok or not ip_ok:
        retry_after = max(global_retry, ip_retry, 1)
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many requests. Please try again later.",
            headers={"Retry-After": str(retry_after)},
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