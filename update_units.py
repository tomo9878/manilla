
import json
import os

path = 'frontend/src/units_data.json'
if not os.path.exists(path):
    print("File not found")
    exit(1)

with open(path, 'r', encoding='utf-8') as f:
    units = json.load(f)

for u in units:
    uid = u.get('id', '')
    
    # Leader Logic (Match ID substrings)
    if any(n in uid for n in ['Haugen', 'Chase', 'Beightler', 'Griswold', 'Fredrick', 'Whitcomb', 'Hoffman', 'White', 'Hildebrand', 'Soule']):
        u['type'] = 'Leader'
    # Tank Logic
    elif any(n in uid for n in ['44A', '44B', '44D', '637A', '637B', '637C', '754A', '754B']):
        u['type'] = 'Tank'
    # Infantry (Default)
    else:
        u['type'] = 'Infantry'

with open(path, 'w', encoding='utf-8') as f:
    json.dump(units, f, indent=2)

print(f"Updated {len(units)} units with type field.")
