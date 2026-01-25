
import pypdf
import re

def extract_setup_info(pdf_path):
    reader = pypdf.PdfReader(pdf_path)
    text = ""
    for page in reader.pages:
        text += page.extract_text() + "\n"
    
    # Look for the setup section
    # The user mentioned "JAPANESE OPENING SETUP"
    # We'll print the text around that area
    
    match = re.search(r"JAPANESE OPENING SETUP", text, re.IGNORECASE)
    if match:
        start = match.start()
        # Extract a good chunk of text after the header
        return text[start:start+4000]
    else:
        return "Header 'JAPANESE OPENING SETUP' not found in text."

import json

def parse_and_save_units(text):
    units = []
    # Regex to match lines like: Urban 5 Sniper
    # Also handle the glitchy "Fana<EF><BF><BD> c" -> Fanatic
    lines = text.split('\n')
    
    id_counter = 1000 # Start IDs for JP units
    
    for line in lines:
        line = line.strip()
        if not line:
            continue
            
        # Fix Fanatic issue common in PDF extraction
        if "Fana" in line and "c" in line:
            line = re.sub(r"Fana.*?c", "Fanatic", line)
            
        parts = line.split()
        if len(parts) >= 3:
            terrain = parts[0]
            if terrain not in ["Clear", "Urban", "Fort"]:
                continue
                
            try:
                strength = int(parts[1])
                unit_class = " ".join(parts[2:]) # e.g. "Ambush" or "Machine Gun"? No, looks like single words mostly
                
                # Check for known types to avoid garbage
                known_types = ["Sniper", "Ambush", "Barrage", "Fanatic", "Elite", "20mm", "75mm", "105mm", "100/150mm", "150mm", "Mortar", "HMG", "Tank"]
                # Approximate matching or trust the parse?
                # The log showed: Sniper, Ambush, Barrage, Fanatic, Elite.
                # Let's trust the parse but be careful.
                
                unit = {
                    "id": f"jp_{id_counter}",
                    "name": f"JP {terrain} {strength}",
                    "strength": strength,
                    "unitClass": unit_class,
                    "terrainType": terrain, # For the "cup" classification
                    "status": "hidden", # Japanese units start hidden/in cup? Or placed on map? 
                                      # Rule 4.4 says "Unit Pool". They are in the cup (pool).
                                      # But for now we just list them.
                    "frontImage": "jp_back.jpg", # Placeholder: Mystery side
                    "backImage": f"jp_{unit_class.lower()}.jpg", # Placeholder: Revealed side
                    "faction": "JP"
                }
                units.append(unit)
                id_counter += 1
            except ValueError:
                continue

    return units

if __name__ == "__main__":
    pdf_path = "Manila_Rules (1).pdf"
    text = extract_setup_info(pdf_path)
    
    # We need to refine the text extraction to only target the table
    # The previous run output the table, so the regex "JAPANESE OPENING SETUP" worked.
    # But it might include header lines. The parser checks for valid Terrain start, so it should be robust.
    
    jp_units = parse_and_save_units(text)
    
    output_path = "frontend/src/japanese_units_data.json"
    with open(output_path, "w", encoding='utf-8') as f:
        json.dump(jp_units, f, indent=2)
    
    print(f"Saved {len(jp_units)} Japanese units to {output_path}")

