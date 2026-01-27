
import os

path = 'frontend/src/App.jsx'
with open(path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_lines = []
skip = False
handled_start_game = False

for line in lines:
    # 1. StartGame fix (Find JP Unit creation)
    # Look for the line: x: center.x - UNIT_SIZE / 2, // Centering adjustments
    if "x: center.x - UNIT_SIZE / 2," in line and not handled_start_game:
        new_lines.append(line)
        # Add location prop (JP Units)
        # Get indentation
        indent = line[:line.find('x:')]
        new_lines.append(f"{indent}location: area.name,\n")
        # Don't set handled_start_game true here because this line appears in loop?
        # Actually it appears once inside mapData.forEach loop in handleStartGame
        # It might appear elsewhere? Only there.
        continue

    # 2. handleCombatInitiation fix
    if "const handleCombatInitiation = (areaName) => {" in line:
        new_lines.append(line)
        # Skip original body
        skip = True
        
        # Insert new body
        body = """        const area = mapData.find(a => a.name === areaName);
        if (!area) return;

        // Geometry check + Location fallback
        let attackers = units.filter(u => u.faction === 'US' && !['eliminated','out_of_action'].includes(u.status) && (u.location === areaName || isPointInPolygon(u.x, u.y, area.points)));
        let defenders = units.filter(u => u.faction === 'JP' && !['eliminated','out_of_action'].includes(u.status) && (u.location === areaName || isPointInPolygon(u.x, u.y, area.points)));

        if (attackers.length === 0) return;
        if (defenders.length === 0) {
            alert(`Combat Logic: No enemy found in ${areaName} (Att: ${attackers.length})`);
            return;
        }

        setCombatData({
            attackerUnits: attackers,
            defenderUnit: defenders[0],
            terrain: area.terrain,
            areaName: areaName
        });
        setShowCombatModal(true);
"""
        new_lines.append(body)
        continue
    
    if skip:
        # Check for end of function '    };'
        if line.strip() == '};': 
            new_lines.append(line)
            skip = False
        continue

    new_lines.append(line)

with open(path, 'w', encoding='utf-8') as f:
    f.writelines(new_lines)
    
print("Patched App.jsx successfully.")
