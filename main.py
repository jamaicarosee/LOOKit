from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import auth
from routers import navigation
from services.graph_service import graph_service

app = FastAPI(
    title="LOOKit Campus Navigation",
    description="Test Backend routing engine and directory service for RTU Pasig Campus Navigation System",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# AUTH API
app.include_router(auth.router)
# Register routers AFTER app is initialized
app.include_router(navigation.router)
# Optional: include campus router if backend/routers/campus.py exists
try:
    from routers import campus
    app.include_router(campus.router)
except ImportError:
    pass

@app.on_event("startup")
def startup_event():
    # Attempt to load the graph on boot
    try:
        nodes, edges = graph_service.build_graph()
        print(f"Graph loaded on startup: {nodes} nodes, {edges} edges.")
    except Exception as e:
        print(f"Graph load on startup skipped: {e}")

@app.get("/")
def root():
    return {"message": "LOOKit API is online."}