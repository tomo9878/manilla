
import json
import os

# Mapping from User Name to ID substring (or exact ID if known)
# User provided: 1/129, 2/129, etc.
# JSON IDs seen: "37_1-129", "37_Fredrick", "37_637A"

# Data dict: { "Identifier": (Attack, Movement) }
stats_map = {
    "1-129": (4, 6),
    "2-129": (4, 6),
    "3-129": (4, 6),
    "Fredrick": (0, 6), # HQ *
    "637A": (6, 6),
    "1-145": (4, 6),
    "2-145": (4, 6),
    "3-145": (4, 6),
    "Whitcomb": (0, 6), # HQ *
    "637B": (6, 6),
    "1-148": (4, 6),
    "2-148": (4, 6),
    "3-148": (4, 6),
    "White": (0, 6), # HQ *
    "637C": (6, 6)
}

# Also standardizing ID lookups
# The JSON IDs have prefixes like "37_" or "us_37_"? 
# extract_units.py used entryName which was "37_1-129".
# view_file on units_data.json showed "37_1-129".

def update_stats():
    path = 'frontend/src/units_data.json'
    if not os.path.exists(path):
        print("File not found")
        return

    with open(path, 'r', encoding='utf-8') as f:
        units = json.load(f)

    updated_count = 0
    
    for u in units:
        uid = u.get('id', '')
        
        # Heuristic matching
        match_found = False
        
        for key, (atk, mov) in stats_map.items():
            # Check if key identifies this unit.
            # Example: "1-129" should match "37_1-129" but not "11-1-129" (if existing).
            # The 37th ID units usually have "37_" prefix in this file.
            
            # Specific matching logic:
            # If key is "1-129", we look for "1-129" in ID.
            if key in uid:
                # Ensure we don't accidentally match substrings incorrectly?
                # "1-129" is distinct enough.
                # "White" matches "37_White".
                u['attack'] = atk
                u['attack_factor'] = atk # Sync for game_logic
                u['movement'] = mov
                updated_count += 1
                match_found = True
                break
        
        # If no match in this list, do we leave it or set default?
        # User only provided this list. Leave others.

    with open(path, 'w', encoding='utf-8') as f:
        json.dump(units, f, indent=2)

    print(f"Updated {updated_count} units with stats.")

if __name__ == "__main__":
    update_stats()
