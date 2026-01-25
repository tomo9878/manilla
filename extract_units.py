import xml.etree.ElementTree as ET
import json
import os
import sys

def parse_units(xml_path, output_path):
    if not os.path.exists(xml_path):
        print(f"Error: File not found: {xml_path}")
        return

    try:
        tree = ET.parse(xml_path)
        root = tree.getroot()
        
        us_units = []
        
        # Searching for PieceSlot inside ListWidget with entryName="American Units"
        # Since standard ET iteration can be messy with deep nesting, let's walk through.
        
        # We need to find the specific ListWidget
        target_list_widget = None
        for widget in root.iter('VASSAL.build.widget.ListWidget'):
            if widget.attrib.get('entryName') == 'American Units':
                target_list_widget = widget
                break
        
        if target_list_widget is None:
            print("Warning: Could not find 'American Units' list.")
            return

        # Iterate over children (PieceSlots) of the American Units list
        for piece_slot in target_list_widget:
            if piece_slot.tag == 'VASSAL.build.widget.PieceSlot':
                entry_name = piece_slot.attrib.get('entryName')
                content = piece_slot.text
                
                # The text content in Vassal XML is a serialization of the piece traits.
                # We need to extract the image names.
                # Format is complex, but often looks like:
                # ...;back_image.jpg;...   piece;;;front_image.jpg;Piece Name/...
                
                # Simple heuristic extraction:
                # 1. Split by delimiters like ';' or '\t'
                # 2. Look for .jpg filenames
                
                # Let's try to extract front and back images
                # Usually trait sequence is: ..., layer, ..., basic piece
                
                images = []
                if content:
                    parts = content.replace('\\', '\t').split('\t') # Vassal uses backslashes or tabs as separators often
                    
                    for part in parts:
                        subparts = part.split(';')
                        for sub in subparts:
                            if sub.lower().endswith('.jpg') or sub.lower().endswith('.png'):
                                images.append(sub)
                
                # Assumption: First found image might be back, second is front, or vice versa depending on definition order
                # In the raw XML we see:
                # ...ManilaVassalCounterCutTemplateFront_102.jpg... (looks like back or flip?)
                # ...prototype;Unit\	piece;;;ManilaVassalCounterCutTemplateFront_103.jpg... (looks like front)
                
                # Let's collect them.
                # The XML shows: "+/null/emb2;...;back.jpg;..." then "piece;;;front.jpg;Name"
                
                front_image = None
                back_image = None
                
                if len(images) >= 2:
                    # In many Vassal mods, the layer (flip side) is defined first (Back), then the Basic Piece (Front).
                    back_image = images[0]
                    front_image = images[1]
                elif len(images) == 1:
                    front_image = images[0]

                if front_image:
                    us_units.append({
                        "id": entry_name,
                        "name": entry_name, # Use entry name as display name for now
                        "frontImage": front_image.strip(', '),
                        "backImage": back_image.strip(', ') if back_image else None,
                        "faction": "US"
                    })

        print(f"Extracted {len(us_units)} US units.")
        
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(us_units, f, ensure_ascii=False, indent=2)
        print(f"Saved to {output_path}")

    except ET.ParseError as e:
        print(f"Error parsing XML: {e}")

if __name__ == "__main__":
    xml_file = "buildFile.xml"
    json_file = "frontend/src/units_data.json"
    parse_units(xml_file, json_file)
