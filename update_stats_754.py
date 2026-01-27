
import json
import os

# Data dict for 754th Tank Battalion (Turn 6)
# User Input:
# 754/A: 7-6 (Area 1)
# 754/B: 7-6 (Area 2)

stats_map = {
    "37_754A": {"attack": 7, "movement": 6, "startArea": "Area 1"},
    "1C_754B": {"attack": 7, "movement": 6, "startArea": "Area 2"}
}

def update_754_and_check():
    path = 'frontend/src/units_data.json'
    if not os.path.exists(path):
        print("File not found")
        return

    with open(path, 'r', encoding='utf-8') as f:
        units = json.load(f)

    updated_count = 0
    
    # 1. Update 754th
    for u in units:
        uid = u.get('id', '')
        
        if uid in stats_map:
            data = stats_map[uid]
            u['attack'] = data['attack']
            u['attack_factor'] = data['attack']
            u['movement'] = data['movement']
            u['startArea'] = data['startArea'] # Update start area as requested
            updated_count += 1
            print(f"Updated {uid}: Attack {data['attack']}, Move {data['movement']}, Loc {data['startArea']}")

    # 2. Check for missing stats
    missing_units = []
    for u in units:
        if u.get('faction') == 'US':
            # Filter out known non-combat types if any (e.g. Markers?)
            # But earlier we saw Support Units in the file?
            # Let's check based on 'type'
            u_type = u.get('type', 'Unknown')
            
            # Support units might not have 'attack' set continuously? 
            # Or assume 0?
            # Let's check if 'attack' key exists.
            if 'attack' not in u:
                missing_units.append(f"{u.get('name')} ({u.get('id')}) - Type: {u_type}")

    with open(path, 'w', encoding='utf-8') as f:
        json.dump(units, f, indent=2)

    print(f"Total updated: {updated_count}")
    
    if missing_units:
        print("\n--- Units missing 'attack' setting ---")
        for m in missing_units:
            print(m)
    else:
        print("\nAll US units have 'attack' settings.")

if __name__ == "__main__":
    update_754_and_check()
