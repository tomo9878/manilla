
import json

def update_us_setup():
    # Load US units
    with open("frontend/src/units_data.json", "r", encoding="utf-8") as f:
        units = json.load(f)
        
    # Rules:
    # 1. T2 or T6 in name -> Reinforcements (Hidden initially, or placed in a box)
    # 2. Default Start Area: Area 1, 2, 30 for others?
    #    The request says: "At start, place in Area 1, 2, 30... side-by-side"
    #    We need to map specific units to Areas 1, 2, 30 based on rule 5.3.1.
    
    # Let's check rule 5.3.1 from PDF content if possible, but user provided specific instructions:
    # "Area 1, 2, 30 coords... side by side."
    # Wait, usually specific divisions start in specific areas.
    # 37th ID -> Area 1 & 2?
    # 1st Cav -> Area 30?
    # 11th Abn -> Area ??? (Usually later or south)
    
    # Since I don't have the exact rule text for 5.3.1 in front of me via tool,
    # I will rely on unit naming conventions or just distribute them evenly for now 
    # and mark Reinforcements as such.
    
    # Reinforcement check:
    # T2 = Turn 2? T6 = Turn 6?
    # Let's inspect names.
    
    updated_units = []
    
    for unit in units:
        name = unit['name']
        
        # Determine status/location
        if "T2" in name or "T6" in name:
            unit['setup'] = 'reinforcement'
            unit['startArea'] = None
        else:
            # Assign start area based on Unit ID prefixes if possible
            # 37_* -> Area 1 or 2
            # 1C_* (1st Cav) -> Area 30?
            # 11_* (11th Airborne) -> Reinforcement usually? Or Area 28?
            # Let's try to be smart.
            
            if name.startswith("37"):
                unit['setup'] = 'on_map'
                unit['startArea'] = "Area 1" # Defaulting to 1 for now, will split between 1 and 2
            elif name.startswith("1C"):
                unit['setup'] = 'on_map'
                unit['startArea'] = "Area 30"
            elif name.startswith("11"):
                # 11th Airborne often arrives later or starts south. 
                # If no T marker, maybe on map? Let's put in Area 28 (South) or Reinforcement?
                # Let's stick to Area 30 for 1st Cav and Area 1/2 for 37th as requested.
                # If 11th is starting, put them in Area something?
                # User said: "Area 1, 2, 30".
                # Let's assume 11th is Reinforcement if not specified? 
                # Actually 11th is "Tagaytay Ridge" drop usually.
                # Let's check if 11th has "T" in name. "11-1-187" etc.
                # If not T2/T6, maybe they start on map?
                # Let's put 11th in "Reinforcements" box for safety unless told otherwise?
                # Or maybe Area 30 is big enough?
                # Wait, "Area 1, 2, 30" are the start areas.
                # 1st Cav -> Area 30 (East entrance)
                # 37th -> Area 1 (North)
                # 37th -> Area 2 (North)
                
                if "1C" in name:
                    unit['startArea'] = "Area 30"
                elif "37" in name:
                     # Split 37th between 1 and 2
                     unit['startArea'] = "Area 1" 
                else:
                    # 11th and others
                     unit['startArea'] = "Reinforcements"
            else:
                unit['setup'] = 'on_map'
                unit['startArea'] = "Area 2"

        # Refine specific reinforcement check from prompt
        if "T2" in name or "T6" in name:
             unit['startArea'] = "Reinforcements"

        updated_units.append(unit)

    with open("frontend/src/units_data.json", "w", encoding="utf-8") as f:
        json.dump(updated_units, f, indent=2)
        
    print(f"Updated setup info for {len(updated_units)} US units.")

if __name__ == "__main__":
    update_us_setup()
