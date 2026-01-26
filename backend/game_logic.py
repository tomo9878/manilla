import json
import os

class GameLogic:
    def __init__(self):
        self.adjacency = {}
        try:
            # Load adjacency data
            # Assuming backend/adjacency.json relative to current working dir or file location
            base_dir = os.path.dirname(os.path.abspath(__file__))
            adj_path = os.path.join(base_dir, 'adjacency.json')
            if os.path.exists(adj_path):
                with open(adj_path, 'r', encoding='utf-8') as f:
                    self.adjacency = json.load(f)
            else:
                # Fallback for dev/testing if file not found in module dir
                if os.path.exists('backend/adjacency.json'):
                    with open('backend/adjacency.json', 'r', encoding='utf-8') as f:
                        self.adjacency = json.load(f)
                else:
                    print("Warning: adjacency.json not found.")
        except Exception as e:
            print(f"Error loading adjacency: {e}")

    def get_adjacency(self, area_name):
        return self.adjacency.get(area_name, [])

    def calculate_movement_cost(self, from_area, to_area, all_units):
        """
        Calculates MP cost and validation.
        
        Args:
            from_area (str): Name of start area
            to_area (str): Name of destination area
            all_units (list): List of all units dicts
            
        Returns:
            dict: {
                "valid": bool,
                "cost": int,
                "message": str,
                "mandatory_attack": bool
            }
        """
        # 1. Adjacency Check
        if to_area not in self.get_adjacency(from_area):
            return {"valid": False, "cost": 0, "message": "Areas are not adjacent.", "mandatory_attack": False}

        # Identify JP units in To Area and Neighboring Areas
        jp_in_target = [u for u in all_units if u.get('location') == to_area and u.get('faction') == 'JP' and u.get('status') != 'eliminated']
        
        is_target_vacant = len(jp_in_target) == 0
        
        target_cost = 1 # Base
        
        # Determine Target State
        has_unrevealed_jp = any(u.get('status') == 'fresh' for u in jp_in_target) # Assuming 'fresh' for hidden/unrevealed side? Or specific 'unrevealed'?
        # In Rules: Unrevealed (Unit side not shown?) -> Usually represented as specific status or 'fresh' side 2?
        # User said: "Fresh (表面)", "Spent (裏面)".
        # For JP, Unrevealed usually means "Unknown unit" (Hidden).
        # Assuming JP units start as 'fresh' (Hidden/Unrevealed) and become 'revealed' (some status?).
        # User logic: "未判明 (Unrevealed)" -> 4 MF. "判明済み (Revealed)" -> 3 MF.
        # We need a field 'is_revealed' or similar. 
        # If not present, default to Unrevealed (Harder)? Or implementation detail.
        # Let's assume a 'revealed' property in unit dict, defaulting to False.
        
        if not is_target_vacant:
            # JP is present
            if any(not u.get('is_revealed', False) for u in jp_in_target):
                target_cost = 4 # Unrevealed present
            else:
                target_cost = 3 # All revealed
        else:
            # Vacant, check Neighbors for JP ZOC behavior (Rule: Adjacent to JP -> 2 MF)
            # We need neighbors of To Area
            to_neighbors = self.get_adjacency(to_area)
            jp_in_neighbors = [u for u in all_units if u.get('location') in to_neighbors and u.get('faction') == 'JP' and u.get('status') != 'eliminated']
            
            if jp_in_neighbors:
                target_cost = 2
            else:
                target_cost = 1

        # Calculate Mandatory Attack
        # "Entering an area with JP units" -> Mandatory Attack if it wasn't contested before?
        # The logic: If we move INTO a JP occupied area, it is an attack move.
        is_attack_move = not is_target_vacant
        
        return {
            "valid": True,
            "cost": target_cost,
            "message": "OK",
            "mandatory_attack": is_attack_move
        }

    def validate_stacking(self, to_area, all_units):
        """
        Checks stacking limits.
        Rule: Max 6 combat units (Infantry/Tank). HQ does not count.
        Exception: Areas 1, 2, 30 have no limit.
        """
        if to_area in ["Area 1", "Area 2", "Area 30"]:
            return True
            
        us_in_target = [u for u in all_units if u.get('location') == to_area and u.get('faction') != 'JP' and u.get('status') not in ['eliminated', 'out_of_action', 'future']]
        
        # Count counting units
        count = 0
        for u in us_in_target:
            # Check type. Assuming 'type' field exists.
            u_type = u.get('type', 'Unit')
            if u_type in ['Infantry', 'Armor', 'Tank', 'Unit']: # Default Unit counts
                if u.get('is_hq', False) or 'HQ' in u.get('name', ''):
                    continue # HQ doesn't count
                count += 1
                
        # We are validating BEFORE the moving unit arrives? Or including it?
        # Usually validating including the new unit.
        # If client sends all_units INCLUDING the moved unit in the new location, simply count.
        # If client sends state BEFORE move, we add 1.
        # Let's assume validation happens separately.
        
        return count <= 6 


    def process_dawn_phase(self, current_turn, units, morale):
        """
        Executes Dawn Phase logic: Reinforcements, Withdrawals, Leader Casualty Checks.
        
        Args:
            current_turn (int): The turn number (1-9).
            units (list): List of unit dictionaries from the frontend.
            morale (int): Current US Morale.
            
        Returns:
            dict: {
                "units": updated_units,
                "morale": updated_morale,
                "logs": list of strings (log messages)
            }
        """
        logs = []
        logs.append(f"--- Dawn Phase (Turn {current_turn}) ---")
        
        updated_units = []
        
        # --- 1. Leader Casualty Checks & Reinforcement Arrival ---
        # Rule: 
        # - OOA Leaders: Roll 1d6. 1-2 KIA, 3-4 Wounded (Wait 1 turn), 5-6 Immediate.
        # - Wounded Leaders (from prev turn): Return to service.
        # - Future Reinforcements: Check Turn and activate.
        # Exception: Turn 1 has no Leader checks.
        
        for unit in units:
            unit_id = unit.get('id')
            status = unit.get('status', 'fresh') # Default fresh
            u_name = unit.get('name', '')
            
            # --- A. Reinforcements (Hidden Units) ---
            if status == 'future':
                # Turn 2: 11th Airborne (ID usually starts with 11-)
                if current_turn == 2 and ('11-' in unit_id or '11th' in u_name):
                    unit['status'] = 'arriving'
                    logs.append(f"Reinforcement Arrived: {u_name} (11th Airborne)")
                
                # Turn 6: 754th Tank Battalion
                elif current_turn == 6 and ('754' in unit_id or '754' in u_name):
                    unit['status'] = 'arriving'
                    logs.append(f"Reinforcement Arrived: {u_name} (754th Tank)")
                
                updated_units.append(unit)
                continue

            # --- B. Leader Casualty Checks (OOA) ---
            # Heuristic for Leader detection (should match frontend logic or data)
            is_leader = 'HQ' in unit_id or 'Gen' in u_name or any(x in u_name for x in ['Haugen', 'Beightler', 'Chase', 'Griswold', 'Swing', 'Struble'])
            
            if is_leader:
                # Case B-1: Leader currently in OOA -> Roll Mortality
                if status == 'out_of_action':
                    if current_turn == 1:
                        # No checks on Turn 1
                        updated_units.append(unit)
                        continue

                    roll = random.randint(1, 6)
                    logs.append(f"Leader Casualty Check: {u_name} (Rolled {roll})")
                    
                    if roll <= 2: # 1-2: KIA
                        logs.append(f"  -> Result: KIA. Removed from game.")
                        continue # Exclude from list (Eliminate)
                    
                    elif roll <= 4: # 3-4: Wounded
                        logs.append(f"  -> Result: Wounded. In hospital (Returns next Turn).")
                        unit['status'] = 'wounded' # Mark as wounded
                        updated_units.append(unit)
                        
                    else: # 5-6: Immediate Return
                        logs.append(f"  -> Result: Superficial. Returns immediately!")
                        unit['status'] = 'fresh'
                        updated_units.append(unit)
                
                # Case B-2: Leader was Wounded (from previous turn) -> Recover
                elif status == 'wounded':
                    logs.append(f"Wounded Leader {u_name} returns to duty.")
                    unit['status'] = 'fresh' 
                    updated_units.append(unit)
                
                else:
                    updated_units.append(unit)
            else:
                # Non-Leader
                updated_units.append(unit)
        
        # --- 2. Withdrawals (Turn 6: 44th Tank Bn) ---
        if current_turn == 6:
            # Remove 44th Tank Btn units (IDs: 1C_44A, 1C_44B, 1C_44D in json)
            # We match '44A', '44B', '44D' or exact IDs.
            withdrawal_targets = ['1C_44A', '1C_44B', '1C_44D'] 
            
            final_units = []
            for unit in updated_units:
                # Check if unit ID is in target list
                uid = unit.get('id', '')
                if uid in withdrawal_targets:
                    logs.append(f"Withdrawal: {unit.get('name')} ({uid}) ordered to withdraw.")
                    
                    if unit.get('status') == 'out_of_action':
                         morale -= 1
                         logs.append(f"  -> Penalty! Unit was damaged/OOA. Morale -1 (Now {morale}).")
                    continue # Remove unit
                final_units.append(unit)
            updated_units = final_units

        return {
            "units": updated_units,
            "morale": morale,
            "logs": logs
        }

    def process_random_event(self, current_turn, last_event, us_controlled_tags, units, morale):
        """
        Executes Random Event Phase logic (Rule 6.2).
        
        Args:
            current_turn (int): 1-9
            last_event (dict/None): Result from previous turn's event phase
            us_controlled_tags (list): List of tags/terrains controlled by US (e.g. ['Urban', 'Fort'])
            units (list): Current units
            morale (int): Current US Morale
            
        Returns:
            dict: {
                "event": {
                    "name": str,
                    "type": str, # 'Pause', 'Mandatory Attack', 'Japanese Attack', 'No Result'
                    "target": str/None, # e.g. '1C', '37', '11'
                    "roll": int
                },
                "morale": int,
                "logs": list
            }
        """
        logs = []
        logs.append(f"--- Random Event Phase (Turn {current_turn}) ---")
        
        # 1. Roll 3d6
        d1, d2, d3 = random.randint(1, 6), random.randint(1, 6), random.randint(1, 6)
        total = d1 + d2 + d3
        logs.append(f"Rolled 3d6: {d1}+{d2}+{d3} = {total}")
        
        event_name = "No Result"
        event_type = "No Result"
        target = None
        
        # 2. Determine Event from Chart
        if total == 3:
            event_name = "Kembu Group Breakout"
            event_type = "Japanese Attack" # Placeholder for complex logic
        elif total == 4:
            event_name = "Kembu Group Offensive"
            event_type = "Japanese Offensive"
        elif total in [5, 6]:
            event_name = "1st Cavalry Division Pause"
            event_type = "Pause"
            target = "1C"
        elif total in [7, 8]:
            event_name = "37th Infantry Division Pause"
            event_type = "Pause"
            target = "37"
        elif total in [9, 10, 11, 12]:
            event_name = "Civilians and Refugees"
            event_type = "Mandatory Attack Priority"
        elif total in [13, 14]:
            event_name = "11th Airborne Division Pause"
            event_type = "Pause"
            target = "11"
        elif total in [15, 16]:
            event_name = "Iwabuchi Orders Breakout"
            event_type = "Japanese Attack"
        elif total == 17:
            event_name = "Shimbu Group Offensive"
            event_type = "Japanese Offensive"
        elif total == 18:
            event_name = "Shimbu Group Breakout"
            event_type = "Japanese Attack"
            
        logs.append(f"Initial Result: {event_name}")
        
        # 3. Apply Exception Logic (Rule 6.2.1)
        
        # A. Turn 1 & Turn 9 Exceptions for Pause
        if event_type == "Pause":
             if current_turn == 1 or current_turn == 9:
                 logs.append(f"Rule 6.2.1: Pause events are treated as No Result on Turn {current_turn}.")
                 event_name = "No Result"
                 event_type = "No Result"
                 target = None

        # B. Consecutive Pause Check
        # "If the same US division... 2 turns continuous... invalid"
        if event_type == "Pause" and last_event:
            last_target = last_event.get('target')
            last_type = last_event.get('type')
            
            if last_type == 'Pause' and last_target == target:
                logs.append(f"Rule 6.2.1: Consecutive Pause for {target} -> No Result.")
                event_name = "No Result"
                event_type = "No Result"
                target = None

        # C. Iwabuchi Breakout Prerequisite
        # "If US controls no Urban or Fort areas"
        if event_name == "Iwabuchi Orders Breakout":
            has_valid_target = 'Urban' in us_controlled_tags or 'Fort' in us_controlled_tags
            if not has_valid_target:
                logs.append("Rule 6.2.1: US controls no Urban/Fort areas -> No Result.")
                event_name = "No Result"
                event_type = "No Result"
        
        # 4. Immediate Effects (Morale penalties etc.)
        
        # Kembu / Shimbu Offensive: 44th Tank OOA Check
        if event_name in ["Kembu Group Offensive", "Shimbu Group Offensive"]:
            # Check 44th Tank Bat (1C_44A, 1C_44B, 1C_44D) in OOA
            ooa_44th_count = 0
            for u in units:
                if '44' in u.get('id', '') and 'Sherman' in u.get('name', 'Sherman'): # Double check identifier
                    if u.get('status') == 'out_of_action':
                        ooa_44th_count += 1
            
            if ooa_44th_count > 0:
                penalty = ooa_44th_count
                morale -= penalty
                logs.append(f"Offensive Effect: {ooa_44th_count} x 44th Tank units in OOA. Morale -{penalty} (Now {morale}).")
                # Note: "Units in OOA return next turn as reinforcements" -> This is handled in Dawn Phase or requires status change?
                # The rule says: "Units in OOA... are returned next turn as Reinforcements".
                # Implementation: Set status to 'future' or specialized 'returning_next'?
                # For now let's leave them OOA, but maybe add a note/flag?
                # Actually, Dawn Phase creates 44th removal on Turn 6.
                # If this happens before Turn 6, we should probably set them to 'future' with startArea?
                # Since 'Reinforcement' usually implies T+1.
                # Let's keep it simple: Just Log for now. The Dawn phase handles "Wounded" return, maybe we can use that?
                # But these are destroyed tanks?
                # Let's just create a log.
        
        return {
            "event": {
                "name": event_name,
                "type": event_type,
                "target": target,
                "roll": total
            },
            "morale": morale,
            "logs": logs
        }

    def process_supply_roll(self, current_turn, current_supply):
        """
        Executes Supply Phase Step 1: Supply Generation.
        
        Args:
            current_turn (int): 1-9
            current_supply (int): Current accumulated supply points
            
        Returns:
            dict: {
                "roll": int, # Total rolled value
                "added": int, # Actual amount added (considering min 12 rule)
                "new_total": int,
                "logs": list
            }
        """
        logs = []
        d1, d2, d3, d4 = [random.randint(1, 6) for _ in range(4)]
        total_roll = d1 + d2 + d3 + d4
        
        logs.append(f"Supply Roll (4d6): {d1}+{d2}+{d3}+{d4} = {total_roll}")
        
        added_amount = total_roll
        
        # Turn 1 Exception: Minimum 12
        if current_turn == 1 and total_roll < 12:
            added_amount = 12
            logs.append(f"Turn 1 Minimum Supply Rule applied: {total_roll} -> 12")
            
        new_total = current_supply + added_amount
        logs.append(f"Supply Points: {current_supply} + {added_amount} = {new_total}")
        
        return {
            "roll": total_roll,
            "added": added_amount,
            "new_total": new_total,
            "logs": logs
        }

    def process_bloody_streets_check(self, area_data):
        """
        Executes Bloody Streets Impulse Step (Combat Phase start).
        
        Args:
            area_data (list): List of area dicts with units:
                [
                  {
                    "name": "Intramuros",
                    "terrain": "Fort", 
                    "us_count": 2, 
                    "jp_count": 1
                  }, ...
                ]
            
        Returns:
            dict: {
                "results": [
                    {
                        "area": str,
                        "roll": int,
                        "effect": str, # 'No Effect', 'OOA', 'OOA + Morale -1'
                        "required_ooa": int,
                        "morale_penalty": int
                    }
                ],
                "logs": list
            }
        """
        results = []
        logs = []
        logs.append("Checking for Bloody Streets (Urban/Fort + Contested)...")
        
        for area in area_data:
            terrain = area.get('terrain')
            us_count = area.get('us_count', 0)
            jp_count = area.get('jp_count', 0)
            
            # Rule: Urban or Fort AND Contested (Both sides > 0)
            if terrain in ['Urban', 'Fort'] and us_count > 0 and jp_count > 0:
                roll = random.randint(1, 6)
                effect = "No Effect"
                required_ooa = 0
                morale_penalty = 0
                
                if roll <= 2: # 1-2
                    effect = "No Effect"
                    logs.append(f"Bloody Streets in {area['name']}: Rolled {roll} -> No Effect")
                elif roll <= 4: # 3-4
                    effect = "OOA"
                    required_ooa = 1
                    logs.append(f"Bloody Streets in {area['name']}: Rolled {roll} -> US takes 1 OOA!")
                else: # 5-6
                    effect = "OOA + Morale -1"
                    required_ooa = 1
                    morale_penalty = 1
                    logs.append(f"Bloody Streets in {area['name']}: Rolled {roll} -> US takes 1 OOA and Morale -1!")
                
                if required_ooa > 0:
                    results.append({
                        "area": area['name'],
                        "roll": roll,
                        "effect": effect,
                        "required_ooa": required_ooa,
                        "morale_penalty": morale_penalty
                    })
        
        if not results:
            logs.append("No Bloody Streets casualties occurred.")
            
        return {
            "results": results,
            "logs": logs
        }

    def process_overrun_check(self, attack_total, defense_total, defender_df):
        """
        Determines if an Overrun occurs based on combat values.
        Rule: Overrun occurs if Result is Success AND (AT - DT) > Defender DF.
        Assumption: 'Success' typically means AT > DT.
        
        Args:
            attack_total (int): Total Attack Factors (after shifts).
            defense_total (int): Total Defense Factors (Terrain + Units).
            defender_df (int): Defense Factor of the defending unit structure (Japanese DF).
            
        Returns:
            dict: {
                "diff": int,
                "is_success": bool,
                "is_overrun": bool,
                "log": str
            }
        """
        diff = attack_total - defense_total
        
        # Determine Success (Generic rule: Attacker > Defender)
        # In many CRT systems, specific odds are needed, but for Overrun calculation:
        is_success = diff > 0
        
        is_overrun = False
        if is_success:
            if diff > defender_df:
                is_overrun = True
        
        log_msg = f"Combat Stats: AT {attack_total} vs DT {defense_total} (Diff {diff}). Defender DF {defender_df}."
        if is_overrun:
            log_msg += " -> OVERRUN! (Diff > DF)"
        elif is_success:
            log_msg += " -> Success (No Overrun)"
        else:
            log_msg += " -> Failed/Stalemate"
            
        return {
            "diff": diff,
            "is_success": is_success,
            "is_overrun": is_overrun,
            "log": log_msg
        }

    def process_end_combat_phase(self, units, morale):
        """
        Resets all Spent units to Fresh and reduces Morale by 1.
        
        Returns:
            dict: {
                "units": list,
                "morale": int,
                "logs": list
            }
        """
        logs = []
        logs.append("--- End of Combat Phase ---")
        
        updated_units = []
        flip_count = 0
        
        for u in units:
            if u.get('status') == 'spent':
                u['status'] = 'fresh'
                flip_count += 1
            updated_units.append(u)
            
        logs.append(f"Reset {flip_count} Spent units to Fresh.")
        
        # Rule: Morale -1 at end of phase
        new_morale = morale - 1
        logs.append(f"Morale Check: {morale} -> {new_morale} (-1 for Phase End)")
        
        return {
            "units": updated_units,
            "morale": new_morale,
            "logs": logs
        }
