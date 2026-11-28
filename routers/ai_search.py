from typing import Any, Dict, List, Literal, Optional
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field, field_validator
from dependencies import get_current_user, get_current_user_profile
from services import ai_search_service as ai
from services.audit_service import get_client_ip

router = APIRouter(prefix="/api/ai-search", tags=["AI Search"])

# Same public access as normal location search; a valid, active user token unlocks staff results.
_optional_bearer = HTTPBearer(auto_error=False)


class AISearchRequest(BaseModel):
    query: str = Field(..., description="Plain-language question, e.g. 'where is the registrar on the 2nd floor'")
    limit: int = Field(default=5, ge=1, le=10)

    @field_validator("query", mode="before")
    @classmethod
    def _clean_query(cls, value: Any) -> str:
        if not isinstance(value, str):
            raise ValueError("query must be text.")
        cleaned = ai.clean_query(value)
        if len(cleaned) < ai.MIN_QUERY_LENGTH:
            raise ValueError(f"query must have at least {ai.MIN_QUERY_LENGTH} characters.")
        if len(cleaned) > ai.MAX_QUERY_LENGTH:
            raise ValueError(f"query must be at most {ai.MAX_QUERY_LENGTH} characters.")
        return cleaned


class AISearchMatch(BaseModel):
    id: str
    category: Literal["location", "staff"]
    reason: str = Field(..., max_length=ai.MAX_REASON_CHARS + 1)
    confidence: float = Field(..., ge=0.0, le=1.0)
    item: Dict[str, Any]


class AISearchResponse(BaseModel):
    query: str
    matches: List[AISearchMatch]
    fallback_used: bool
    fallback_reason: Optional[str] = None
    retry_after_seconds: Optional[int] = None
    message: Optional[str] = None


def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_optional_bearer),
) -> Optional[dict]:
    """Returns the active signed-in user profile, or None for guests / invalid / deactivated tokens."""
    if not credentials:
        return None
    try:
        user = get_current_user(credentials)
        return get_current_user_profile(user)
    except HTTPException:
        return None


@router.post("", response_model=AISearchResponse)
async def ai_search(
    payload: AISearchRequest,
    request: Request,
    user: Optional[dict] = Depends(get_optional_user),
):
    """
    Natural-language search over campus locations (and staff, for active signed-in users).
    Falls back to keyword matching (fallback_used=true) whenever the AI is unavailable.
    """
    client_key = f"user:{user['id']}" if user else f"ip:{get_client_ip(request) or 'unknown'}"
    allowed, retry_after = ai.client_limiter.hit(client_key)
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={
                "message": "Too many searches. Please wait a moment and try again.",
                "retry_after_seconds": retry_after,
            },
            headers={"Retry-After": str(retry_after)},
        )

    result = await ai.search(payload.query, limit=payload.limit, include_staff=user is not None)
    return {"query": payload.query, **result}