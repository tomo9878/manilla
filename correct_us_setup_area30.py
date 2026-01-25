
import json

def correct_us_setup_area30():
    # Load US units
    with open("frontend/src/units_data.json", "r", encoding="utf-8") as f:
        units = json.load(f)
        
    # Updates for Area 30 (San Rafael) - 11th Airborne Division
    # 1/511, 2/511, 3/511, HQ Haugen
    
    count_updated = 0
    
    # Target IDs found in previous logical check:
    # 11-1-511, 11-2-511, 11-3-511, 11-Haugen
    
    target_ids = ["11-1-511", "11-2-511", "11-3-511", "11-Haugen"]
    
    for unit in units:
        u_id = unit['id']
        
        if u_id in target_ids:
            unit['setup'] = 'on_map'
            unit['startArea'] = "Area 30"
            count_updated += 1
        
        # Also ensure 11-Soule, 11-Hildebrand etc. stay valid (Reinforcements?)
        # User only specified 1/511, 2/511, 3/511, HQ Haugen for Area 30.
        # So other 11th Airborne parts (187, 188) remain in Reinforcements as per previous logic (which defaulted them to Reinforcements).
            
    # Save
    with open("frontend/src/units_data.json", "w", encoding="utf-8") as f:
        json.dump(units, f, indent=2)
        
    print(f"Corrected {count_updated} units to start in Area 30.")

if __name__ == "__main__":
    correct_us_setup_area30()
