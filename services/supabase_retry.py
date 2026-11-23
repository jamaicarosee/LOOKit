import time
from typing import Callable, TypeVar
import httpx

try:
    import httpcore
    _TRANSIENT_ERRORS = (
        httpx.ConnectError,
        httpx.RemoteProtocolError,
        httpx.ReadError,
        httpx.ReadTimeout,
        httpcore.ConnectError,
        httpcore.RemoteProtocolError,
        httpcore.ReadError,
        OSError,
    )
except ImportError:
    _TRANSIENT_ERRORS = (
        httpx.ConnectError,
        httpx.RemoteProtocolError,
        httpx.ReadError,
        httpx.ReadTimeout,
        OSError,
    )

T = TypeVar("T")


def execute_with_retry(
    operation: Callable[[], T],
    *,
    attempts: int = 3,
    base_delay: float = 0.15,
) -> T:
    """
    Executes a synchronous Supabase/httpx call with short retries on transient
    TLS/socket errors (e.g., SSL UNEXPECTED_EOF_WHILE_READING on stale sockets).
    """
    last_exc: Exception | None = None
    for attempt in range(1, attempts + 1):
        try:
            return operation()
        except _TRANSIENT_ERRORS as exc:
            last_exc = exc
            if attempt == attempts:
                break
            time.sleep(base_delay * attempt)

    assert last_exc is not None
    raise last_exc