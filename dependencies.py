from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from database import supabase

security = HTTPBearer()

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
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
                detail="Invalid or expired authentication credentials."
            )

        user = user_response.user
        return {
            "id": user.id,
            "email": user.email,
            "metadata": user.user_metadata or {}
        }

    except Exception as e:
        error_msg = str(e)
        if "expired" in error_msg.lower():
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Session has expired. Please sign in again."
            )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Authentication failed: {error_msg}"
        )