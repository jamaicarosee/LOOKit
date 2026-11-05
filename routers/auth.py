from fastapi import APIRouter, Depends
from dependencies import get_current_user
from database import supabase

router = APIRouter(prefix="/api/auth", tags=["Auth"])

@router.get("/me")
def get_user_profile(user: dict = Depends(get_current_user)):
    """
    Protected endpoint: returns the authenticated user's profile from public.users.
    """

    profile = (
        supabase.table("users")
        .select("id, full_name, email, created_at, role")
        .eq("id", user["id"])
        .single()
        .execute()
    )
    return {"user": profile.data}