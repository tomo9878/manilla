from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from game_logic import GameLogic

app = FastAPI()
game_logic = GameLogic()

# CORS configuration to allow frontend to communicate with backend
origins = [
    "http://localhost:5173",  # Vite default port
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class Unit(BaseModel):
    id: str
    name: str = ""
    status: str = "fresh"
    type: str = "Unit"
    # Allow arbitrary extra fields (coordinates, images, etc.)
    class Config:
        extra = "allow"

class DawnPhaseRequest(BaseModel):
    currentTurn: int
    units: List[Unit]
    morale: int

@app.get("/")
def read_root():
    return {"status": "ok", "message": "Manila: Savage Streets 1945 Backend Online"}

@app.get("/api/health")
def health_check():
    return {"status": "healthy"}

@app.post("/api/phase/dawn")
def run_dawn_phase(data: DawnPhaseRequest):
    """
    Endpoint to trigger Dawn Phase logic (Reinforcements, Withdrawals, Leader Checks).
    """
    # Convert Pydantic models to list of dicts for the logic engine
    units_dict = [u.dict() for u in data.units]
    
    result = game_logic.process_dawn_phase(
        data.currentTurn, 
        units_dict, 
        data.morale
    )
    return result

class RandomEventRequest(BaseModel):
    currentTurn: int
    units: List[Unit]
    morale: int
    lastEvent: Optional[Dict[str, Any]] = None # The event result object from previous turn
    usControlledTags: List[str] = [] # List of tags like 'Urban', 'Fort', 'Clear'

@app.post("/api/phase/event")
def run_random_event_phase(data: RandomEventRequest):
    """
    Endpoint to trigger Random Event Phase logic (Rule 6.2).
    """
    units_dict = [u.dict() for u in data.units]
    
    result = game_logic.process_random_event(
        data.currentTurn,
        data.lastEvent,
        data.usControlledTags,
        units_dict,
        data.morale
    )
    return result
    return result

class SupplyRollRequest(BaseModel):
    currentTurn: int
    currentSupply: int

@app.post("/api/phase/supply/roll")
def run_supply_roll(data: SupplyRollRequest):
    """
    Endpoint for Supply Phase Step 1: Roll for Supply Points.
    """
    result = game_logic.process_supply_roll(
        data.currentTurn,
        data.currentSupply
    )
    return result

class BloodyStreetsRequest(BaseModel):
    areaData: List[Dict[str, Any]] # List of { "name": "...", "terrain": "...", "us_count": X, "jp_count": Y }

@app.post("/api/phase/bloody_streets")
def run_bloody_streets_check(data: BloodyStreetsRequest):
    """
    Endpoint for Bloody Streets Impulse (Start of Combat Phase).
    """
    result = game_logic.process_bloody_streets_check(data.areaData)
    return result

