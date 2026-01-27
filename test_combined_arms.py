
import sys
import os
import json

# Add backend directory to sys.path to import game_logic
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))

from game_logic import GameLogic

def test_combined_arms_logic():
    logic = GameLogic()
    
    print("--- White Box Test: Combined Arms Bonus ---")
    
    # Scene Setup
    # 1. Units
    # Lead: 1/145 (Infantry, AF 4)
    # Support 1: 637/A (Tank, AF 6)
    # Support 2: HQ Whitcomb (Leader)
    
    units = [
        {
            "id": "37_1-145",
            "name": "1/145",
            "type": "Infantry",
            "attack_factor": 4, 
            "is_lead": True
        },
        {
            "id": "37_637A",
            "name": "637/A",
            "type": "Tank",
            "attack_factor": 6,
            "is_lead": False
        },
        {
            "id": "37_Whitcomb",
            "name": "HQ Whitcomb",
            "type": "Leader",
            "attack_factor": 0,
            "is_lead": False
        }
    ]
    
    # 2. Support
    # Artillery x1
    support_modifiers = {
        "artillery": 1,
        "engineer": 0,
        "air_support": False
    }
    
    # 3. Environment
    morale = 30 # High enough to not be shaken, but not Strong Morale >= 45 (Wait, Strong Morale threshold?)
    # Rule 8.3: "If Morale is 10 or more -> +1 AV"? 
    # Let's check logic implementation.
    # game_logic.py line 566: if morale >= 10: av += 1. 
    # Wait, Standard rules usually say Morale Track determines bonuses using High Morale.
    # User didn't mention Morale Bonus in expected result.
    # 4 (Base) + 2 (Add) + 1 (Arty) + 1 (CA) = 8.
    # If Morale >= 10 adds +1, result would be 9.
    # If User expects 8, either Morale is low (<10) OR Morale Bonus is not applicable/User forgot.
    # Or maybe "Strong Morale" threshold is not 10?
    # Let's assume Morale is < 10 for this test to match strict expectation of 8,
    # OR we clarify if Morale bonus is expected.
    # User's calculation: 4 + 2 + 1 + 1 = 8.
    # No mention of "Strong Morale".
    # I will set Morale to 9 to avoid "Strong Morale" bonus, ensuring we isolate the Combined Arms test.
    
    morale = 9 
    terrain = "Urban" # Irrelevant for AV? (Civilians might matter)
    
    print("\n[Input Data]")
    print(f"Units: {[u['name'] + ' (' + u['type'] + ')' for u in units]}")
    print(f"Support: {support_modifiers}")
    print(f"Morale: {morale} (to avoid Strong Morale bonus)")
    
    # Calculate
    result = logic.calculate_combat_stats(
        attacker_units=units,
        support_modifiers=support_modifiers,
        morale=morale,
        terrain_type=terrain,
        defender_unit=None # Not needed for AV
    )
    
    print("\n[Calculation Logs]")
    for log in result['logs']:
        print(f"  {log}")
        
    print("\n[Result]")
    print(f"Calculated AV: {result['av']}")
    
    expected_av = 8
    
    if result['av'] == expected_av:
        print("SUCCESS: Result matches Expected AV (8).")
    else:
        print(f"FAILURE: Expected {expected_av}, got {result['av']}.")

if __name__ == "__main__":
    test_combined_arms_logic()
