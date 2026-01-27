
import json
import os

# Data dict for remaining 11th Airborne units
# User Input:
# 11-Hildebrand: 0-6
# 11-1-188: 4-4
# 11-2-188: 4-4
# 11-Soule: 0-6

stats_map = {
    "11-Hildebrand": {"attack": 0, "movement": 6},
    "11-1-188": {"attack": 4, "movement": 4},
    "11-2-188": {"attack": 4, "movement": 4},
    "11-Soule": {"attack": 0, "movement": 6}
}

def update_final_stats():
    path = 'frontend/src/units_data.json'
    if not os.path.exists(path):
        print("File not found")
        return

    with open(path, 'r', encoding='utf-8') as f:
        units = json.load(f)

    updated_count = 0
    
    # 1. Update Remaining Units
    for u in units:
        uid = u.get('id', '')
        
        if uid in stats_map:
            data = stats_map[uid]
            u['attack'] = data['attack']
            u['attack_factor'] = data['attack']
            u['movement'] = data['movement']
            updated_count += 1
            print(f"Updated {uid}: Attack {data['attack']}, Move {data['movement']}")

    # 2. Final Check for missing stats
    missing_units = []
    for u in units:
        if u.get('faction') == 'US':
            # Support Units might be an exception?
            # Let's see if we have any support units without attack stats.
            # Support units usually: "Air Support", "Artillery Support", "Engineer Support"
            # They don't have movement or attack in the same way, but let's check.
            
            # Check for specific Support IDs or Names if needed.
            # The previous check listed only the units we just fixed.
            
            if 'attack' not in u:
                missing_units.append(f"{u.get('name')} ({u.get('id')})")

    with open(path, 'w', encoding='utf-8') as f:
        json.dump(units, f, indent=2)

    print(f"Total updated: {updated_count}")
    
    if missing_units:
        print("\n--- Units still missing 'attack' setting ---")
        for m in missing_units:
            print(m)
    else:
        print("\nAll US units now have 'attack' settings.")

if __name__ == "__main__":
    update_final_stats()
