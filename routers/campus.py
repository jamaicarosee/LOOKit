from fastapi import APIRouter, HTTPException
from database import supabase

router = APIRouter(prefix="/api/campus", tags=["Campus Metadata"])

@router.get("/buildings")
def get_buildings():
    """Returns all campus superstructures (Javier, MAE, CED, CAS)."""
    res = supabase.table("buildings").select("buildingid, name, code, description").execute()
    return res.data or []

@router.get("/buildings/{building_code}/floors")
def get_building_floors(building_code: str):
    """Returns the valid floors for a given building code."""
    res = supabase.table("floors").select("floorid, floor_level, buildings!inner(code)").eq("buildings.code", building_code.upper()).order("floor_level").execute()
    return res.data or []