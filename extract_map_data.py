import xml.etree.ElementTree as ET
import json
import os
import sys

def parse_vassal_xml(xml_path, output_path):
    if not os.path.exists(xml_path):
        print(f"Error: File not found: {xml_path}")
        # Create dummy data for testing if file missing
        create_dummy_data(output_path)
        return

    try:
        tree = ET.parse(xml_path)
        root = tree.getroot()
        
        areas = []
        
        # Searching strategy: Look for elements that likely represent map zones.
        # Vassal often uses 'Zone' tags. We need to find elements with 'name' and 'path'.
        # Assuming the structure is somewhat flat or deeply nested, recursive search is best.
        
        # First pass: Extract Zones
        zone_map = {}
        for elem in root.iter():
            if elem.tag.endswith('Zone') and 'name' in elem.attrib and 'path' in elem.attrib:
                name = elem.attrib['name']
                path_str = elem.attrib['path']
                
                # Default terrain
                terrain = 'Clear'
                
                try:
                    points = []
                    coords = path_str.split(';')
                    for coord in coords:
                        if ',' in coord:
                            x, y = map(float, coord.split(','))
                            points.append(x)
                            points.append(y)
                    
                    if points:
                        zone_map[name] = {
                            "name": name,
                            "terrain": terrain, 
                            "points": points
                        }
                except ValueError:
                    continue

        # Second pass: Infer terrain from MassKeyCommands or other markers
        # Loop through MassKeyCommand to find "Deploy Area X" -> Terrain Deck
        for elem in root.iter():
            if elem.tag.endswith('MassKeyCommand'):
                btn_text = elem.attrib.get('buttonText', '')
                target = elem.attrib.get('target', '')
                
                if btn_text.startswith('Deploy Area'):
                    # Extract Area Name "Area X"
                    try:
                        area_name = btn_text.replace('Deploy ', '').strip()
                        # Target format example: MAP|true|DECK|||||0|0|Clear Terrain|false|||EQUALS||
                        parts = target.split('|')
                        if len(parts) > 9:
                            deck_name = parts[9]
                            # Map deck name to simplified terrain
                            terrain_type = 'Clear'
                            if 'Urban' in deck_name:
                                terrain_type = 'Urban'
                            elif 'Fort' in deck_name:
                                terrain_type = 'Fort'
                            
                            if area_name in zone_map:
                                zone_map[area_name]['terrain'] = terrain_type
                    except:
                        continue

        areas = list(zone_map.values())
        # Sort by name number if possible for cleaner JSON
        def sort_key(x):
            try:
                 # Extract number from "Area 12" -> 12
                 return int(x['name'].replace('Area', '').strip())
            except:
                 return 999
        
        areas.sort(key=sort_key)


        print(f"Extracted {len(areas)} areas.")
        
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(areas, f, ensure_ascii=False, indent=2)
        print(f"Saved to {output_path}")

    except ET.ParseError as e:
        print(f"Error parsing XML: {e}")

def create_dummy_data(output_path):
    print("Creating dummy map_data.json for testing...")
    # Create a few dummy zones relative to a large map (e.g. 3000x4000)
    dummy_data = [
        {
            "name": "Intramuros",
            "terrain": "City",
            "points": [100, 100, 300, 100, 300, 300, 100, 300]
        },
        {
            "name": "Port Area",
            "terrain": "Dock",
            "points": [320, 100, 500, 100, 500, 250, 320, 250]
        },
        {
            "name": "Rizal Park",
            "terrain": "Clear",
            "points": [100, 320, 300, 320, 300, 500, 100, 500]
        }
    ]
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(dummy_data, f, ensure_ascii=False, indent=2)
    print(f"Saved dummy data to {output_path}")

if __name__ == "__main__":
    # Default paths
    xml_file = "buildFile.xml"
    json_file = "frontend/src/map_data.json" # Saving directly to frontend src for easy import
    
    if len(sys.argv) > 1:
        xml_file = sys.argv[1]
    
    parse_vassal_xml(xml_file, json_file)
