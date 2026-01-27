
import json
import os

# Data dict for 1st Cavalry Division (Area 2)
# Parsing user input:
# 1/5: 5-6
# 1/12: 5-6
# Chase: *-6 (0-6)
# 44/A: 7-6
# 44/B: 7-6
# 2/7: 5-6
# 2/8: 5-6
# Hoffman: *-6 (0-6)
# 44/D: 5-7
# 302RCN: 3-8

stats_map = {
    "1C_1-5": (5, 6),
    "1C_1-12": (5, 6),
    "1C_Chase": (0, 6), # HQ
    "1C_44A": (7, 6),
    "1C_44B": (7, 6),
    "1C_2-7": (5, 6),
    "1C_2-8": (5, 6),
    "1C_Hoffman": (0, 6), # HQ
    "1C_44D": (5, 7),
    "1C_302rcn": (3, 8)
}

def update_1c_stats():
    path = 'frontend/src/units_data.json'
    if not os.path.exists(path):
        print("File not found")
        return

    with open(path, 'r', encoding='utf-8') as f:
        units = json.load(f)

    updated_count = 0
    
    for u in units:
        uid = u.get('id', '')
        
        # Direct ID match for these since we know the exact IDs
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
    update_1c_stats()
