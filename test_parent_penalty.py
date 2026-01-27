
import sys
import os
import json

# Add backend directory to sys.path
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))

from game_logic import GameLogic

def test_parent_penalty():
    logic = GameLogic()
    
    print("--- White Box Test: Parent Formation Penalty (Rule 11.5) ---")
    
    # Scene Setup
    # 1. Units (Mixed 37th and 1st)
    # 1/145 (37th, AF 4)
    # 637/A (37th, AF 6)
    # 1/5 (1st Cav, AF 5)
    
    units = [
        {
            "id": "37_1-145",
            "name": "1/145 (37th)",
            "type": "Infantry",
            "attack_factor": 4, 
            "is_lead": True
        },
        {
            "id": "37_637A",
            "name": "637/A (37th)",
            "type": "Tank",
            "attack_factor": 6,
            "is_lead": False
        },
        {
            "id": "1C_1-5",
            "name": "1/5 (1st)",
            "type": "Infantry",
            "attack_factor": 5,
            "is_lead": False
        }
    ]
    
    # 2. Support (Artillery needed for Combined Arms, but doesn't count for Parent penalty)
    support_modifiers = {
        "artillery": 1,
        "engineer": 0,
        "air_support": False
    }
    
    # 3. Environment
    morale = 9 # < 10 to avoid Strong Morale bonus
    terrain = "Clear"
    
    print("\n[Input Data]")
    print(f"Units: {[u['name'] for u in units]}")
    print(f"Support: {support_modifiers}")
    
    # Calculate
    result = logic.calculate_combat_stats(
        attacker_units=units,
        support_modifiers=support_modifiers,
        morale=morale,
        terrain_type=terrain,
        defender_unit=None
    )
    
    print("\n[Calculation Logs]")
    for log in result['logs']:
        print(f"  {log}")
        
    print("\n[Result]")
    print(f"Calculated AV: {result['av']}")
    
    # Analyzing Expected Result
    # Base (1/145): 4
    # Additional (+2 units): +2
    # Support (Arty): +1
    # Combined Arms (Inf+Tank+Supp): +1
    # Parent Penalty (37th + 1st = 2 types): -1
    # Total: 4 + 2 + 1 + 1 - 1 = 7.
    
    expected_av = 7
    
    if result['av'] == expected_av:
        print(f"SUCCESS: Result is {result['av']} (Matches logical expectation 7).")
    else:
        print(f"FAILURE: Expected {expected_av}, got {result['av']}.")

if __name__ == "__main__":
    test_parent_penalty()
