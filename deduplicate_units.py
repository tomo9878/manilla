
import json

def remove_duplicates():
    path = "frontend/src/units_data.json"
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
        
    seen_ids = set()
    unique_data = []
    
    duplicates = []
    
    for unit in data:
        u_id = unit['id']
        if u_id in seen_ids:
            duplicates.append(u_id)
        else:
            seen_ids.add(u_id)
            unique_data.append(unit)
            
    if duplicates:
        print(f"Found {len(duplicates)} duplicates: {duplicates}")
        print(f"Reducing total units from {len(data)} to {len(unique_data)}")
        
        with open(path, "w", encoding="utf-8") as f:
            json.dump(unique_data, f, indent=2)
    else:
        print("No duplicates found in units_data.json")

if __name__ == "__main__":
    remove_duplicates()
