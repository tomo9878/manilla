
from backend.game_logic import GameLogic

def main():
    logic = GameLogic()
    
    # --- Setup Scenario ---
    attacker_units = [
        {"name": "637/A", "type": "Tank", "attack_factor": 6, "is_lead": True},
        {"name": "1/145", "type": "Infantry", "attack_factor": 4},
        {"name": "HQ Whitcomb", "type": "Leader", "is_hq": True}
    ]
    
    support_modifiers = {
        "artillery": 2,
        "engineer": 1,
        "air_support": False
    }
    
    morale = 19
    terrain_type = "Urban"
    
    defender_unit = {
        "name": "JP Defender",
        "defense_factor": 9,
        "is_elite": False
    }
    
    # Calculate
    print("--- Calculating Combat Stats ---")
    result = logic.calculate_combat_stats(
        attacker_units=attacker_units,
        support_modifiers=support_modifiers,
        morale=morale,
        terrain_type=terrain_type,
        defender_unit=defender_unit
    )
    
    print(f"AV: {result['av']}")
    print(f"DV: {result['dv']}")
    print("\nLogs:")
    for log in result['logs']:
        print(f" - {log}")
        
    print("\n--- Expected ---")
    print("AV Should be: 6 (Base) + 2 (Add) + 2 (Arty) + 2 (Eng) + 1 (Combined) + 1 (Morale) = 14")
    print("DV Should be: 9 (Base) + 3 (Terrain) = 12")

if __name__ == "__main__":
    main()
