from fastapi import APIRouter, Depends
from dependencies import get_current_user_profile, require_admin

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
    }