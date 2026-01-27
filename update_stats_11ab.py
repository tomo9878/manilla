
import json
import os

# Data dict for 11th Airborne Division (Area 30 / Reinforcements)
# User Input:
# 1/511: 4-4
# 2/511: 4-4
# 3/511: 4-4
# HQ Haugen: *-6 (0-6)

stats_map = {
    "11-1-511": (4, 4),
    "11-2-511": (4, 4),
    "11-3-511": (4, 4),
    "11-Haugen": (0, 6) # HQ
}

def update_11ab_stats():
    path = 'frontend/src/units_data.json'
    if not os.path.exists(path):
        print("File not found")
        return

    with open(path, 'r', encoding='utf-8') as f:
        units = json.load(f)

    updated_count = 0
    
    for u in units:
        uid = u.get('id', '')
        
        if uid in stats_map:
            atk, mov = stats_map[uid]
            
            u['attack'] = atk
            u['attack_factor'] = atk
            u['movement'] = mov
            updated_count += 1
            print(f"Updated {uid}: Attack {atk}, Move {mov}")

    with open(path, 'w', encoding='utf-8') as f:
        json.dump(units, f, indent=2)

    print(f"Total updated: {updated_count}")

if __name__ == "__main__":
    update_11ab_stats()
