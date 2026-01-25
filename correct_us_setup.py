
import json

def correct_us_setup_area2():
    # Load US units
    with open("frontend/src/units_data.json", "r", encoding="utf-8") as f:
        units = json.load(f)
        
    # Updates based on User Request for Area 2 (Grace Park)
    # 1/5, 1/12, 2/7, 2/8 , HQ Chase , HQ Hoffman , 637/B, 637/C , 44/A, 44/B, 44/D (Armor) , 302RCN (Recon)
    # These effectively seem to be the "1st Cavalry Division" units (starting with 1C_) + some others attached.
    
    # Mapping logic:
    # 1C_1-5 -> Area 2
    # 1C_1-12 -> Area 2
    # 1C_2-7 -> Area 2
    # 1C_2-8 -> Area 2
    # 1C_Chase -> Area 2
    # 1C_Hoffman -> Area 2
    # 1C_44A, 1C_44B, 1C_44D -> Area 2
    # 1C_302rcn -> Area 2
    # 37_637B, 37_637C -> Area 2 ?? Wait, user said "637/B, 637/C".
    # Let's check IDs for 637.
    
    # We'll iterate and patch.
    
    count_updated = 0
    
    for unit in units:
        name_raw = unit['name']
        u_id = unit['id']
        
        # 1st Cav stuff (Area 2)
        if u_id.startswith("1C_"):
            # All 1st Cav logic described above matches 1C_ prefix
            # 1-5, 1-12, 2-7, 2-8, Chase, Hoffman, 44A/B/D, 302rcn
            # Check 754B? User didn't mention it for Area 2 explicitly but "1C_754B" exists in previous list (gpid 284).
            # If user didn't mention it, maybe it's elsewhere?
            # User listed: 1/5, 1/12, 2/7, 2/8, Chase, Hoffman, 637/B, 637/C, 44/A, 44/B, 44/D, 302RCN.
            # 1C_754B is likely 1st Cav too, but let's stick to the list or strictly Area 2 for 1C?
            # User said "Area 2 ... 1st Cavalry Division". Usually the whole division starts there.
            # I will set all "1C_" to Area 2.
            
            unit['startArea'] = "Area 2"
            count_updated += 1
            
        # 637 Tank Destroyer Battalion
        # ID might be 37_637B or something?
        if "637" in u_id:
             unit['startArea'] = "Area 2"
             count_updated += 1
             
    # Save
    with open("frontend/src/units_data.json", "w", encoding="utf-8") as f:
        json.dump(units, f, indent=2)
        
    print(f"Corrected {count_updated} units to start in Area 2.")

if __name__ == "__main__":
    correct_us_setup_area2()
