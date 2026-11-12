import time
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, field_validator
from database import supabase
from dependencies import get_current_user_profile, require_admin
from services.audit_service import error_text, get_client_ip, log_audit

router = APIRouter(prefix="/api/auth", tags=["Auth"])

# Rate limit for Forgot Password (10mins)
_reset_cooldowns = {}
_RESET_COOLDOWN_SECONDS = 300

class ForgotPasswordPayload(BaseModel):
    email: str
    redirect_to: str


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
   Email request with 10 minutes cooldown per accounts.
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
        # Cooldown
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