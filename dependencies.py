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

    # Clean double "Bearer " prefix if manually typed
    if token.lower().startswith("bearer "):
        token = token[7:].strip()

    try:
        # Supabase verifies token validity, signature, and expiration
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
    except Exception as e:
        error_msg = str(e)
        if "expired" in error_msg.lower():
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Session has expired. Please sign in again.",
            )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Authentication failed: {error_msg}",
        )


def get_current_user_profile(
    user: dict = Depends(get_current_user),
) -> dict:
    """
    Fetches the full user profile (including role) from public.users.
    """
    try:
        response = (
            supabase.table("users")
<<<<<<< HEAD
            .select("id, full_name, email, created_at, role")
=======
            .select("id, full_name, email, created_at, role, is_active, must_change_password")
>>>>>>> 0892d3b (updated for admin dashboard)
            .eq("id", user["id"])
            .maybe_single()
            .execute()
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to query user profile: {str(e)}",
        )

    if not response or not response.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User profile not found in public.users.",
        )

<<<<<<< HEAD
=======
    # Deactivated accounts are blocked immediately, even if their JWT is still valid.
    if not response.data.get("is_active", True):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account has been deactivated.",
        )

>>>>>>> 0892d3b (updated for admin dashboard)
    return response.data


def require_admin(
    profile: dict = Depends(get_current_user_profile),
) -> dict:
    """
    Guard dependency that restricts endpoint access strictly to users with role == 'admin'.
    """
    if profile.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges are required to access this resource.",
        )
<<<<<<< HEAD
=======
    # Admin-created accounts start with a temporary password that must be changed first.
    if profile.get("must_change_password"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You must change your temporary password before using admin features.",
        )
>>>>>>> 0892d3b (updated for admin dashboard)
    return profile