import sys
import os

# Create dummy units based on observing units_data.json and App.jsx behavior
units = [
    # 754th units (currently setup on map in JSON, but should be futures for logic verification)
    {"id": "1C_754B", "name": "1C_754B", "status": "future"}, 
    {"id": "37_754A", "name": "37_754A", "status": "future"},
    
    # 44th units for withdrawal
    {"id": "1C_44A", "name": "1C_44A", "status": "fresh"},
    {"id": "1C_44B", "name": "1C_44B", "status": "fresh"},
    {"id": "1C_44D", "name": "1C_44D", "status": "fresh"},
    
    # Random other unit
    {"id": "1C_1-5", "name": "1C_1-5", "status": "fresh"}
]

# Add backend directory to path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from game_logic import GameLogic

logic = GameLogic()

print("--- TEST 1: Turn 2 Reinforcements (11th Airborne) ---")
# Add 11th abn dummy
units_t2 = [{"id": "11-1-511", "name": "11-1-511", "status": "future"}]
res_t2 = logic.process_dawn_phase(2, units_t2, 12)
print("Logs:", res_t2['logs'])
print("Units:", res_t2['units'])

print("\n--- TEST 2: Turn 6 Reinforcements (754th) ---")
res_t6_r = logic.process_dawn_phase(6, units, 12)
# Check if 754 changed status
for u in res_t6_r['units']:
    if '754' in u['id']:
        print(f"Unit {u['id']} status: {u.get('status')}")

print("\n--- TEST 3: Turn 6 Withdrawal (44th) ---")
# Check if 44th removed
res_t6_w = logic.process_dawn_phase(6, units, 12)
found_44 = any('44' in u['id'] for u in res_t6_w['units'])
print(f"44th Units Remaining? {found_44}")
print("Logs:", res_t6_w['logs'])
