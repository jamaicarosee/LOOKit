<<<<<<< HEAD
from fastapi import APIRouter, Depends
from dependencies import get_current_user_profile, require_admin
=======
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, field_validator

from database import supabase
from dependencies import get_current_user_profile, require_admin
from services.audit_service import error_text, get_client_ip, log_audit
>>>>>>> 0892d3b (updated for admin dashboard)

router = APIRouter(prefix="/api/auth", tags=["Auth"])


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
<<<<<<< HEAD
    }
=======
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
    The flag is only cleared here, after the backend itself changed the password,
    so a client cannot dismiss the forced change without actually changing it.
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
>>>>>>> 0892d3b (updated for admin dashboard)
