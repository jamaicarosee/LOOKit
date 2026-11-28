import os
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from pydantic import BaseModel, Field, field_validator
from database import supabase
from dependencies import get_current_user_profile, require_admin
from services.audit_service import error_text, get_client_ip, log_audit
from services.rate_limit_service import SlidingWindowLimiter, rate_limit
from services.supabase_retry import execute_with_retry
from services.validation_service import (
    validate_email_address,
    validate_strong_password,
)

router = APIRouter(prefix="/api/auth", tags=["Auth"])

FRONTEND_URL = (os.getenv("FRONTEND_URL") or "http://localhost:5173").strip().rstrip("/")

# Bounded per-email cooldown for Forgot Password (1 request per 5 minutes)
_reset_email_limiter = SlidingWindowLimiter(limit=1, window_seconds=300, max_keys=5000)


class ForgotPasswordPayload(BaseModel):
    email: str = Field(..., min_length=3, max_length=254)
    # Accepted for backward compatibility with older clients, but ignored server-side
    redirect_to: Optional[str] = Field(default=None, max_length=500)


class AccountAvailabilityPayload(BaseModel):
    email: Optional[str] = Field(default=None, max_length=254)
    full_name: Optional[str] = Field(default=None, max_length=200)


class ChangePassword(BaseModel):
    new_password: str = Field(..., min_length=8, max_length=72)

    @field_validator("new_password")
    @classmethod
    def _password(cls, value: str) -> str:
        return validate_strong_password(value)


def _escape_ilike(value: str) -> str:
    """Escapes SQL ILIKE wildcards for safe parameterized matching."""
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def _normalize_name(name: Optional[str]) -> str:
    return " ".join((name or "").strip().split())


def _find_duplicate_user(
    email: Optional[str],
    full_name: Optional[str],
    exclude_user_id: Optional[str] = None,
) -> Optional[str]:
    """
    Checks public.users using parameterized ILIKE queries (no raw .or_() interpolation)
    for a matching email or full_name, excluding `exclude_user_id` when provided.
    """
    norm_email = (email or "").strip().lower()
    norm_name = _normalize_name(full_name)

    if norm_email:
        def _query_email():
            q = supabase.table("users").select("id").ilike("email", _escape_ilike(norm_email))
            if exclude_user_id:
                q = q.neq("id", exclude_user_id)
            return q.limit(1).execute()

        res = execute_with_retry(_query_email)
        if res.data:
            return "email"

    if norm_name:
        def _query_name():
            q = supabase.table("users").select("id").ilike("full_name", _escape_ilike(norm_name))
            if exclude_user_id:
                q = q.neq("id", exclude_user_id)
            return q.limit(1).execute()

        res = execute_with_retry(_query_name)
        if res.data:
            return "full_name"

    return None


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


@router.post(
    "/check-availability",
    dependencies=[Depends(rate_limit(limit=15, window_seconds=60, scope="auth_availability"))],
)
def check_account_availability(payload: AccountAvailabilityPayload):
    """
    Public pre-check for manual Sign Up:
    1. Validates email format, blocks disposable domains, and verifies DNS MX records.
    2. Blocks duplicate email or full name across Email/Password and Google accounts.
    """
    if payload.email is not None:
        is_valid, error_message = validate_email_address(payload.email)
        if not is_valid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=error_message,
            )

    try:
        conflict = _find_duplicate_user(payload.email, payload.full_name)
        if conflict:
            return {
                "exists": True,
                "reason": conflict,
                "message": "Account already exists.",
            }
        return {"exists": False}
    except Exception as exc:
        print(f"[LOOKit Auth] Availability check failed: {exc}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication service is temporarily unavailable. Please try again.",
        )


@router.post(
    "/validate-google",
    dependencies=[Depends(rate_limit(limit=20, window_seconds=60, scope="auth_validate_google"))],
)
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


@router.get(
    "/me",
    dependencies=[Depends(rate_limit(limit=60, window_seconds=60, scope="auth_me"))],
)
def get_user_profile(profile: dict = Depends(get_current_user_profile)):
    """
    Protected endpoint: returns the authenticated user's profile from public.users.
    """
    return {"user": profile}


@router.get(
    "/admin-check",
    dependencies=[Depends(rate_limit(limit=60, window_seconds=60, scope="auth_admin_check"))],
)
def verify_admin_status(admin_profile: dict = Depends(require_admin)):
    """
    Protected endpoint: confirms the caller holds valid 'admin' privileges.
    """
    return {
        "is_admin": True,
        "user": admin_profile,
    }


@router.post(
    "/change-password",
    dependencies=[Depends(rate_limit(limit=5, window_seconds=60, scope="auth_change_password"))],
)
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
        print(f"[LOOKit Auth] Password update failed for {profile['id']}: {exc}")
        log_audit(
            profile, "UPDATE", "user", entity_id=profile["id"], entity_label=label,
            changes=changes, status="failed", error=error_text(exc), ip=ip,
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not change the password. Please try again.",
        )

    if was_forced:
        try:
            supabase.table("users").update({"must_change_password": False}).eq("id", profile["id"]).execute()
        except Exception as exc:
            print(f"[LOOKit Auth] Failed clearing must_change_password for {profile['id']}: {exc}")
            log_audit(
                profile, "UPDATE", "user", entity_id=profile["id"], entity_label=label,
                changes=changes, status="failed",
                error=f"Password changed, but the flag could not be cleared: {exc}", ip=ip,
            )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Password changed, but your account could not be updated. Please try again.",
            )

    log_audit(profile, "UPDATE", "user", entity_id=profile["id"], entity_label=label, changes=changes, ip=ip)
    return {"status": "password_changed"}


@router.post(
    "/forgot-password",
    dependencies=[Depends(rate_limit(limit=10, window_seconds=300, scope="auth_forgot_ip"))],
)
def forgot_password(payload: ForgotPasswordPayload, request: Request):
    """
    Sends a password reset email with a 5-minute cooldown per email and per-IP rate limiting.
    Always derives redirect_to from server-side FRONTEND_URL and returns a uniform response
    to prevent account enumeration.
    """
    ip = get_client_ip(request)
    email = payload.email.strip().lower()

    allowed, retry_after = _reset_email_limiter.hit(email)
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Please wait before requesting another password reset email.",
            headers={"Retry-After": str(retry_after)},
        )

    try:
        res = (
            supabase.table("users")
            .select("id, is_active")
            .ilike("email", _escape_ilike(email))
            .limit(1)
            .execute()
        )
    except Exception as exc:
        print(f"[LOOKit Auth] Forgot-password lookup failed: {exc}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Service temporarily unavailable. Please try again.",
        )

    if not res.data:
        return {"status": "sent"}

    user_row = res.data[0]
    if not user_row.get("is_active"):
        # Log internally, but return uniform response so deactivated emails cannot be enumerated
        log_audit(
            {"id": user_row["id"], "email": email},
            "PASSWORD_RESET_REQUEST",
            "auth",
            entity_id=user_row["id"],
            entity_label=email,
            status="failed",
            error="Reset requested for deactivated account",
            ip=ip,
        )
        return {"status": "sent"}

    try:
        supabase.auth.reset_password_email(email, options={"redirect_to": FRONTEND_URL})
        log_audit(
            {"id": user_row["id"], "email": email},
            "PASSWORD_RESET_REQUEST",
            "auth",
            entity_id=user_row["id"],
            entity_label=email,
            ip=ip,
        )
    except Exception as exc:
        print(f"[LOOKit Auth] Failed to send reset email: {exc}")
        log_audit(
            {"id": user_row["id"], "email": email},
            "PASSWORD_RESET_REQUEST",
            "auth",
            entity_id=user_row["id"],
            entity_label=email,
            status="failed",
            error=str(exc),
            ip=ip,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to send reset email. Please try again later.",
        )

    return {"status": "sent"}