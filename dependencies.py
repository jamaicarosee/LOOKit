from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from database import supabase

security = HTTPBearer()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> dict:
    """
    Validates Supabase Bearer JWT via Supabase Auth and returns user identity.
    """
    token = credentials.credentials.strip()

    if token.lower().startswith("bearer "):
        token = token[7:].strip()

    try:
        user_response = supabase.auth.get_user(token)

        if not user_response or not user_response.user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired authentication credentials.",
            )

        user = user_response.user
        return {
            "id": user.id,
            "email": user.email,
            "metadata": user.user_metadata or {},
        }

    except HTTPException:
        raise
    except Exception as exc:
        error_msg = str(exc)
        if "expired" in error_msg.lower():
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Session has expired. Please sign in again.",
            )
        print(f"[LOOKit Auth] Token verification failed: {type(exc).__name__}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication failed. Please sign in again.",
        )


def get_current_user_profile(
    user: dict = Depends(get_current_user),
) -> dict:
    """
    Fetches the full user profile (including role & is_active) from public.users.
    """
    try:
        response = (
            supabase.table("users")
            .select("id, full_name, email, created_at, role, is_active, must_change_password")
            .eq("id", user["id"])
            .maybe_single()
            .execute()
        )
    except Exception as exc:
        print(f"[LOOKit Auth] Failed to query user profile for {user['id']}: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to load user profile.",
        )

    if not response or not response.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User profile not found.",
        )

    if not response.data.get("is_active", True):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account has been deactivated.",
        )

    return response.data


def require_admin(
    profile: dict = Depends(get_current_user_profile),
) -> dict:
    """
    Guard dependency that restricts endpoint access strictly to active admins
    who have completed any forced temporary-password change.
    """
    if profile.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges are required to access this resource.",
        )
    if profile.get("must_change_password"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You must change your temporary password before using admin features.",
        )
    return profile