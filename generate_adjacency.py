import json
import math
import os

def dist_sq(p1, p2):
    return (p1[0] - p2[0])**2 + (p1[1] - p2[1])**2

def are_areas_adjacent(points_a, points_b, threshold=30.0, min_shared_points=1):
    """
    Check if areas are adjacent based on vertex proximity.
    If multiple vertices are close, likely adjacent.
    Threshold set to 30.0 to cover gap.
    min_shared_points=1 might be enough if vertices are shared corners.
    But let's aim for 2 to avoid diagonal touching? 
    Actually, 1 point touch is usually not "movement allowed" in wargames (corner vs edge).
    Let's try min 2.
    """
    pts_a = [(points_a[i], points_a[i+1]) for i in range(0, len(points_a), 2)]
    pts_b = [(points_b[i], points_b[i+1]) for i in range(0, len(points_b), 2)]
    
    close_count = 0
    
    # Method: Count how many points in A are close to ANY point in B.
    # To act as "shared edges", usually at least 2 points (defining an edge) should be close.
    
    for pa in pts_a:
        for pb in pts_b:
            if dist_sq(pa, pb) < threshold**2:
                close_count += 1
                break # Found a match for pa, move to next point in A
                
    # Also check B to A to be robust? Not needed if symmetric logic.
    
    return close_count >= 2

def main():
    map_path = 'frontend/src/map_data.json'
    output_path = 'frontend/src/adjacency.json'
    
    with open(map_path, 'r', encoding='utf-8') as f:
        areas = json.load(f)
        
    # Filter out non-area items (Turn tracks etc)
    # They usually don't have Terrain or have specific names
    # But checking all is fine, just won't be adjacent.
    
    adjacency = {area['name']: set() for area in areas}
    
    print(f"Processing {len(areas)} areas with Vertex Proximity Check...")
    
    for i in range(len(areas)):
        area_a = areas[i]
        if 'points' not in area_a: continue
        
        for j in range(i + 1, len(areas)):
            area_b = areas[j]
            if 'points' not in area_b: continue
            
            if are_areas_adjacent(area_a['points'], area_b['points']):
                adjacency[area_a['name']].add(area_b['name'])
                adjacency[area_b['name']].add(area_a['name'])
                
    # --- Special Rules / Exceptions ---
    # Rule: Area 11/12 <-> Area 37 blocked (Pasig River)
    blocked_pairs = [
        ("Area 11", "Area 37"),
        ("Area 12", "Area 37")
    ]
    
    for a1, a2 in blocked_pairs:
        if a2 in adjacency.get(a1, set()):
            print(f"Applying Exception: Removing link {a1} <-> {a2}")
            adjacency[a1].remove(a2)
        if a1 in adjacency.get(a2, set()):
            adjacency[a2].remove(a1)
            
    # Convert sets to sorted lists for JSON
    final_adj = {k: sorted(list(v)) for k, v in adjacency.items()}
    
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(final_adj, f, indent=2)
        
    print(f"Adjacency data saved to {output_path}")

if __name__ == "__main__":
    main()
