from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Import our modular routers
from routers import auth, navigation, staff

# Import graph service to initialize it on startup
from services.graph_service import campus_graph_service

app = FastAPI(
    title="LOOKit Campus Navigation API",
    description="Backend API for RTU Pasig Campus Navigation System",
    version="1.0.0"
)

# CORS configuration (Currently set to "*" for development)
# Make sure to change allow_origins to your deployed frontend URL in production
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def startup_event():
    """Loads the routing graph and POIs into memory when the server starts."""
    print("[LOOKit API] Server starting up. Loading campus navigation graph...")
    campus_graph_service.reload_graph()
    print("[LOOKit API] Startup complete. Ready to serve routes.")

# Register all API routers
app.include_router(auth.router)
app.include_router(navigation.router)
app.include_router(staff.router)

@app.get("/")
def root():
    return {"message": "LOOKit Backend API is running. Visit /docs for the Swagger UI."}