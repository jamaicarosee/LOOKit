import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

# Import modular routers
from routers import ai_search, audit, auth, navigation, staff, users
# Import graph service to initialize it on startup
from services.graph_service import campus_graph_service

ENV = (os.getenv("ENV") or "development").strip().lower()
IS_PRODUCTION = ENV == "production"


def _parse_allowed_origins() -> list[str]:
    raw = (os.getenv("ALLOWED_ORIGINS") or "").strip()
    if raw:
        return [origin.strip().rstrip("/") for origin in raw.split(",") if origin.strip()]
    if IS_PRODUCTION:
        print("[LOOKit API] WARNING: ALLOWED_ORIGINS is not set in production. Blocking cross-origin requests.")
        return []
    return [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:4173",
        "http://127.0.0.1:4173",
    ]


@asynccontextmanager
async def lifespan(_app: FastAPI):
    """Loads the routing graph and POIs into memory when the server starts."""
    print(f"[LOOKit API] Starting up in '{ENV}' mode. Loading campus navigation graph...")
    campus_graph_service.reload_graph()
    print("[LOOKit API] Startup complete. Ready to serve routes.")
    yield


app = FastAPI(
    title="LOOKit Campus Navigation API",
    description="Backend API for RTU Pasig Campus Navigation System",
    version="1.0.0",
    lifespan=lifespan,
    docs_url=None if IS_PRODUCTION else "/docs",
    redoc_url=None if IS_PRODUCTION else "/redoc",
    openapi_url=None if IS_PRODUCTION else "/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_parse_allowed_origins(),
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
    expose_headers=["Retry-After", "Content-Disposition"],
)


@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "no-referrer")
    return response


# Register all API routers
app.include_router(auth.router)
app.include_router(navigation.router)
app.include_router(staff.router)
app.include_router(users.router)
app.include_router(audit.router)
app.include_router(ai_search.router)


@app.get("/")
def root():
    return {"status": "ok", "service": "LOOKit Campus Navigation API"}