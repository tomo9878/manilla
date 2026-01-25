
import json
import re
import os

def update_japanese_units():
    # 1. Read buildFile.xml to find image mappings
    with open("buildFile.xml", "r", encoding="utf-8") as f:
        xml_content = f.read()

    # Regex to find CardSlots with entryName and image path
    # Example: <VASSAL.build.widget.CardSlot entryName="Clear-Sniper3" ... ;ClearSniper.jpg; ...
    # We look for entryName="..." and then later ;Filename.jpg;
    
    # Pattern: entryName="([^"]+)"[^>]+;([^;]+\.jpg);
    # This might need to be looser to catch lines.
    
    image_map = {}
    
    # Direct match on the lines from previous view_file output
    # <VASSAL.build.widget.CardSlot entryName="Clear-Ambush3" gpid="192" height="64" width="75">+/null/prototype;ClearChit	piece;;;ManilaVassalCounterCutTemplateFront_32.jpg;Clear-Ambush3/	null;0;0;192;0</VASSAL.build.widget.CardSlot>
    
    # We can iterate line by line to be safe
    for line in xml_content.split('\n'):
        if "VASSAL.build.widget.CardSlot" in line and ".jpg" in line:
            # Extract entryName
            m_name = re.search(r'entryName="([^"]+)"', line)
            # Extract image filename: ;Filename.jpg;
            m_img = re.search(r';([^;]+\.jpg);', line)
            
            if m_name and m_img:
                entry_name = m_name.group(1)
                img_file = m_img.group(1)
                image_map[entry_name] = img_file

    print(f"Found {len(image_map)} image mappings from XML.")
    
    # 2. Read existing japanese_units_data.json
    json_path = "frontend/src/japanese_units_data.json"
    with open(json_path, "r", encoding="utf-8") as f:
        units = json.load(f)
        
    # 3. Update units with correct images
    # Back images (Revealed)
    # Front images (Hidden) -> ClearChit.jpg, UrbanChit -> ManilaVassalCounterCutTemplateFront_31.jpg, FortChit.jpg
    
    updated_count = 0
    
    for unit in units:
        terrain = unit['terrainType']
        u_class = unit['unitClass']
        strength = str(unit['strength'])
        
        # Construct possible entryName keys
        # The XML uses: "Clear-Sniper3", "Urban_Sniper5", "Fort_Ambush7"
        # Format seems to be: "{Terrain}-{Class}{Strength}" or "{Terrain}_{Class}{Strength}"
        
        keys_to_try = []
        
        if terrain == "Clear":
            key1 = f"Clear-{u_class}{strength}" # e.g. Clear-Sniper3
            keys_to_try.append(key1)
            unit['frontImage'] = "ClearChit.jpg"
        elif terrain == "Urban":
            key1 = f"Urban_{u_class}{strength}" # e.g. Urban_Sniper5
            keys_to_try.append(key1)
            # Special handling for duplicates like Urban_Sniper7_2? The JSON doesn't track ID uniqueness vs XML slots yet.
            # But for visual mapping, the first one is fine.
            unit['frontImage'] = "ManilaVassalCounterCutTemplateFront_31.jpg"
        elif terrain == "Fort":
            key1 = f"Fort_{u_class}{strength}" # e.g. Fort_Ambush7
            keys_to_try.append(key1)
            unit['frontImage'] = "FortChit.jpg"
            
        found_img = None
        for k in keys_to_try:
            if k in image_map:
                found_img = image_map[k]
                break
        
        # Fallback for "Elite" vs "Fanatic" mismatch if any (PDF might say Fanatic but XML Fanatic vs Elite?)
        # Actually XML has both.
        
        if found_img:
            unit['backImage'] = found_img
            updated_count += 1
        else:
            print(f"Warning: No image found for {unit['name']} (Keys tried: {keys_to_try})")
            
    # 4. Save
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(units, f, indent=2)
        
    print(f"Updated {updated_count} units with images.")

if __name__ == "__main__":
    update_japanese_units()
