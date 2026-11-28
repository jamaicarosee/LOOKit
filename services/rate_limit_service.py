"""
Thread-safe, memory-bounded sliding-window rate limiter for LOOKit API.
Uses get_client_ip() so Render's X-Forwarded-For proxy header is respected
when TRUSTED_PROXY_COUNT=1 is configured.
"""
import threading
import time
from collections import deque
from typing import Deque, Dict, Tuple
from fastapi import HTTPException, Request, status
from services.audit_service import get_client_ip


class SlidingWindowLimiter:
    def __init__(self, limit: int, window_seconds: int, max_keys: int = 5000):
        self.limit = limit
        self.window = window_seconds
        self.max_keys = max_keys
        self._hits: Dict[str, Deque[float]] = {}
        self._lock = threading.Lock()

    def hit(self, key: str) -> Tuple[bool, int]:
        """Records a request for `key`. Returns (allowed, retry_after_seconds)."""
        if self.limit <= 0:
            return True, 0

        now = time.monotonic()
        cutoff = now - self.window

        with self._lock:
            bucket = self._hits.get(key)
            if bucket is None:
                if len(self._hits) >= self.max_keys:
                    self._prune(cutoff)
                    if len(self._hits) >= self.max_keys:
                        return False, self.window
                bucket = self._hits[key] = deque()

            while bucket and bucket[0] <= cutoff:
                bucket.popleft()

            if len(bucket) >= self.limit:
                retry_after = max(int(self.window - (now - bucket[0])) + 1, 1)
                return False, retry_after

            bucket.append(now)
            return True, 0

    def _prune(self, cutoff: float) -> None:
        stale = [k for k, q in self._hits.items() if not q or q[-1] <= cutoff]
        for k in stale:
            del self._hits[k]


def rate_limit(limit: int, window_seconds: int, scope: str):
    """
    FastAPI dependency factory for per-IP rate limiting.
    Example: Depends(rate_limit(30, 60, "nav_route"))
    """
    limiter = SlidingWindowLimiter(limit=limit, window_seconds=window_seconds)

    def _dependency(request: Request) -> None:
        ip = get_client_ip(request) or "unknown"
        allowed, retry_after = limiter.hit(f"{scope}:{ip}")
        if not allowed:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many requests. Please wait a moment and try again.",
                headers={"Retry-After": str(retry_after)},
            )

    return _dependency