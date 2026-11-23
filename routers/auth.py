import time
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from pydantic import BaseModel, field_validator
from database import supabase
from dependencies import get_current_user_profile, require_admin
from services.audit_service import error_text, get_client_ip, log_audit
from services.supabase_retry import execute_with_retry

router = APIRouter(prefix="/api/auth", tags=["Auth"])

# Rate limit for Forgot Password (5 mins)
_reset_cooldowns = {}
_RESET_COOLDOWN_SECONDS = 300


class ForgotPasswordPayload(BaseModel):
    email: str
    redirect_to: str


class AccountAvailabilityPayload(BaseModel):
    email: Optional[str] = None
    full_name: Optional[str] = None


def _escape_or_ilike(value: str) -> str:
    """Escapes PostgREST ILIKE wildcards and quotes for safe use inside .or_()."""
    escaped = value.replace("\\", "\\\\").replace('"', '\\"')
    return escaped.replace("%", "\\%").replace("_", "\\_")


def _normalize_name(name: Optional[str]) -> str:
    return " ".join((name or "").strip().split())


def _find_duplicate_user(
    email: Optional[str],
    full_name: Optional[str],
    exclude_user_id: Optional[str] = None,
) -> Optional[str]:
    """
    Checks public.users in a single query for a matching email OR full_name
    (case-insensitive), excluding `exclude_user_id` when provided.
    """
    norm_email = (email or "").strip().lower()
    norm_name = _normalize_name(full_name)

    or_filters = []
    if norm_email:
        or_filters.append(f'email.ilike."{_escape_or_ilike(norm_email)}"')
    if norm_name:
        or_filters.append(f'full_name.ilike."{_escape_or_ilike(norm_name)}"')

    if not or_filters:
        return None

    def _query():
        q = supabase.table("users").select("id, email, full_name").or_(",".join(or_filters))
        if exclude_user_id:
            q = q.neq("id", exclude_user_id)
        return q.limit(1).execute()

    res = execute_with_retry(_query)
    if not res.data:
        return None

    row = res.data[0]
    if norm_email and (row.get("email") or "").strip().lower() == norm_email:
        return "email"
    return "full_name"


def _is_newly_created_user(user_obj) -> bool:
    """Checks whether a Supabase Auth user was created within the last 90 seconds."""
    created_at = getattr(user_obj, "created_at", None)
    if not created_at:
        return False
    try:
        if isinstance(created_at, str):
            dt = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
        else:
            dt = created_at
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return (datetime.now(timezone.utc) - dt).total_seconds() <= 90
    except Exception:
        return False


@router.post("/check-availability")
def check_account_availability(payload: AccountAvailabilityPayload):
    """
    Public pre-check for manual Sign Up: blocks duplicate email or full name
    regardless of whether the existing account used Email/Password or Google.
    """
    try:
        conflict = _find_duplicate_user(payload.email, payload.full_name)
        if conflict:
            return {
                "exists": True,
                "reason": conflict,
                "message": "Full name or email already exists.",
            }
        return {"exists": False}
    except Exception as exc:
        print(f"[LOOKit Auth] Availability check failed: {exc}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication service is temporarily unavailable. Please try again.",
        )


@router.post("/validate-google")
def validate_google_account(authorization: Optional[str] = Header(default=None)):
    """
    Validates a Google OAuth sign-in immediately after redirect:
    - Blocks Google login if the email was already registered via Email/Password.
    - Blocks Google login if another user already has the same email or full name.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authorization token.",
        )

    token = authorization.split(" ", 1)[1].strip()
    try:
        user_res = execute_with_retry(lambda: supabase.auth.get_user(token))
        auth_user = getattr(user_res, "user", None)
    except Exception as exc:
        print(f"[LOOKit Auth] Supabase get_user failed during Google validation: {exc}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Could not verify Google session. Please try again.",
        )

    if not auth_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid session.",
        )

    identities = getattr(auth_user, "identities", None) or []
    providers = {
        (ident.get("provider") if isinstance(ident, dict) else getattr(ident, "provider", None))
        for ident in identities
    }

    # Case 1: Existing Email/Password account auto-linked with Google by Supabase
    if "email" in providers and "google" in providers:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Account already exists.",
        )

    metadata = getattr(auth_user, "user_metadata", None) or {}
    full_name = (
        metadata.get("full_name")
        or metadata.get("name")
        or metadata.get("display_name")
        or ""
    )

    # Case 2: Another account already uses this email or full name
    try:
        conflict = _find_duplicate_user(
            email=getattr(auth_user, "email", None),
            full_name=full_name,
            exclude_user_id=str(auth_user.id),
        )
    except Exception as exc:
        print(f"[LOOKit Auth] Duplicate check failed during Google validation: {exc}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Could not complete account validation. Please try again.",
        )

    if conflict:
        if "email" not in providers and _is_newly_created_user(auth_user):
            try:
                execute_with_retry(
                    lambda: supabase.table("users").delete().eq("id", str(auth_user.id)).execute()
                )
                execute_with_retry(
                    lambda: supabase.auth.admin.delete_user(str(auth_user.id))
                )
            except Exception as exc:
                print(f"[LOOKit Auth] Cleanup of rejected Google user {auth_user.id} failed: {exc}")

        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Account already exists.",
        )

    return {"status": "ok"}


@router.get("/me")
def get_user_profile(profile: dict = Depends(get_current_user_profile)):
    """
    Protected endpoint: returns the authenticated user's profile from public.users.
    """
    return {"user": profile}


@router.get("/admin-check")
def verify_admin_status(admin_profile: dict = Depends(require_admin)):
    """
    Protected endpoint: confirms the caller holds valid 'admin' privileges.
    """
    return {
        "is_admin": True,
        "user": admin_profile,
    }


class ChangePassword(BaseModel):
    new_password: str

    @field_validator("new_password")
    @classmethod
    def _password(cls, value: str) -> str:
        if len(value) < 8:
            raise ValueError("Password must be at least 8 characters")
        if len(value) > 72:  # bcrypt ignores everything past 72 bytes
            raise ValueError("Password must be at most 72 characters")
        return value


@router.post("/change-password")
def change_password(
    payload: ChangePassword,
    request: Request,
    profile: dict = Depends(get_current_user_profile),
):
    """
    Signed-in user: sets a new password and clears the must_change_password flag.
    """
    ip = get_client_ip(request)
    was_forced = bool(profile.get("must_change_password"))
    changes = {"password": {"from": "***", "to": "***"}}
    if was_forced:
        changes["must_change_password"] = {"from": True, "to": False}
    label = profile.get("email")

    try:
        supabase.auth.admin.update_user_by_id(profile["id"], {"password": payload.new_password})
    except Exception as exc:
        log_audit(profile, "UPDATE", "user", entity_id=profile["id"], entity_label=label,
                  changes=changes, status="failed", error=error_text(exc), ip=ip)
        raise HTTPException(status_code=400, detail=f"Could not change the password: {exc}")

    if was_forced:
        try:
            supabase.table("users").update({"must_change_password": False}).eq("id", profile["id"]).execute()
        except Exception as exc:
            log_audit(profile, "UPDATE", "user", entity_id=profile["id"], entity_label=label,
                      changes=changes, status="failed",
                      error=f"Password changed, but the flag could not be cleared: {exc}", ip=ip)
            raise HTTPException(
                status_code=500,
                detail="Password changed, but your account could not be updated. Please try again.",
            )

    log_audit(profile, "UPDATE", "user", entity_id=profile["id"], entity_label=label, changes=changes, ip=ip)
    return {"status": "password_changed"}


@router.post("/forgot-password")
def forgot_password(payload: ForgotPasswordPayload, request: Request):
    """
    Email request with 5 minutes cooldown per account.
    """
    ip = get_client_ip(request)
    email = payload.email.strip().lower()
    now = time.monotonic()

    # 1. Check for 5 mins cooldown
    last_request = _reset_cooldowns.get(email)
    if last_request and (now - last_request) < _RESET_COOLDOWN_SECONDS:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Request Timed Out, try again later!."
        )

    # 2. Verify if the email is registered and the user using it is active
    res = supabase.table("users").select("id, is_active").eq("email", email).execute()
    if not res.data:
        _reset_cooldowns[email] = now
        return {"status": "sent"}

    user_row = res.data[0]
    if not user_row.get("is_active"):
        raise HTTPException(status_code=403, detail="This account has been deactivated.")

    # 3. Get reset link via Supabase Auth
    try:
        supabase.auth.reset_password_email(email, options={"redirect_to": payload.redirect_to})
        _reset_cooldowns[email] = now
        log_audit({"id": user_row["id"], "email": email}, "PASSWORD_RESET_REQUEST", "auth",
                  entity_id=user_row["id"], entity_label=email, ip=ip)
    except Exception as exc:
        log_audit({"id": user_row["id"], "email": email}, "PASSWORD_RESET_REQUEST", "auth",
                  entity_id=user_row["id"], entity_label=email, status="failed", error=str(exc), ip=ip)
        raise HTTPException(status_code=500, detail="Failed to send reset email.")

    return {"status": "sent"}