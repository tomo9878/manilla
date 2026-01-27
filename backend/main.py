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




class ResolveCombatRequest(BaseModel):
    attackValue: int
    defenseValue: int
    terrainMod: int = 0
    strategyMod: int = 0
    isNight: bool = False
    isElite: bool = False
    hasAirSupport: bool = False

@app.post("/api/combat/resolve")
def run_combat_resolution(data: ResolveCombatRequest):
    """
    Endpoint for executing Combat Resolution (Roll dice, determine outcome).
    """
    result = game_logic.process_combat(
        data.attackValue,
        data.defenseValue,
        data.terrainMod,
        data.strategyMod,
        data.isNight,
        data.isElite,
        data.hasAirSupport
    )
    return result

class CalculateCombatRequest(BaseModel):
    attackerUnits: List[Dict[str, Any]]
    supportModifiers: Dict[str, Any]
    morale: int
    terrainType: str
    defenderUnit: Optional[Dict[str, Any]] = None
    isMandatoryAttack: bool = False
    eventCiviActive: bool = False

@app.post("/api/combat/calculate")
def calculate_combat_stats(data: CalculateCombatRequest):
    """
    Calculate predicted AV and DV.
    """
    result = game_logic.calculate_combat_stats(
        data.attackerUnits,
        data.supportModifiers,
        data.morale,
        data.terrainType,
        data.defenderUnit,
        data.isMandatoryAttack,
        data.eventCiviActive
    )
    return result

class ApplyCombatResultRequest(BaseModel):
    resultType: str
    attackerUnits: List[Dict[str, Any]]
    defenderUnit: Optional[Dict[str, Any]] = None
    targetArea: str
    currentMorale: int
    strategyCasualtyIds: List[str] = []

@app.post("/api/combat/apply_result")
def apply_combat_result(data: ApplyCombatResultRequest):
    """
    Apply combat result state updates (Status changes, Morale, Control).
    """
    result = game_logic.apply_combat_result(
        data.resultType,
        data.attackerUnits,
        data.defenderUnit,
        data.targetArea,
        data.currentMorale,
        data.strategyCasualtyIds
    )
    return result

class EndCombatRequest(BaseModel):
    units: List[Unit]
    morale: int

@app.post("/api/phase/end_combat")
def run_end_combat_phase(data: EndCombatRequest):
    """
    Endpoint for End of Combat Phase (Reset units, Morale -1).
    """
    # Convert Pydantic models to list of dicts
    units_dict = [u.dict() for u in data.units]
    
    result = game_logic.process_end_combat_phase(
        units_dict,
        data.morale
    )
    return result


class ValidateMoveRequest(BaseModel):
    fromArea: str
    toArea: str
    units: List[Dict[str, Any]] # Must include 'location', 'faction', 'status'

@app.post("/api/combat/validate_move")
def validate_move(data: ValidateMoveRequest):
    """
    Validate movement options and calculate cost.
    Requires units to have 'location' field populated.
    """
    # 1. Calculate Cost & Adjacency
    result = game_logic.calculate_movement_cost(
        data.fromArea,
        data.toArea,
        data.units
    )
    
    if not result['valid']:
        return result
        
    # Check limit
    # Logic: count existing US units in toArea
    # Stack limit is 6.
    
    # Count current US units in target area
    us_in_target = [u for u in data.units 
                    if u.get('location') == data.toArea 
                    and u.get('faction') != 'JP' 
                    and u.get('status') not in ['eliminated', 'out_of_action', 'future']]
                    
    # Filter types (Infantry/Tank only) - approximated
    current_count = 0
    for u in us_in_target:
        # Assume everything except HQ counts
        if not (u.get('is_hq', False) or 'HQ' in u.get('name', '')):
             current_count += 1
                 
    # Max is 6.
    # If target area is 1, 2, 30 -> No limit.
    limit = 6
    if data.toArea in ["Area 1", "Area 2", "Area 30"]:
        limit = 999
        
    if current_count >= limit:
        return {
            "valid": False,
            "cost": result['cost'],
            "message": f"Stacking Limit Exceeded ({current_count} + 1 > {limit})",
            "mandatory_attack": result['mandatory_attack']
        }
        
    return result


