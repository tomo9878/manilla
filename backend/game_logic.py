import json
import os
import random

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

        return {
            "results": results,
            "logs": logs
        }

    def calculate_combat_stats(self, attacker_units, support_modifiers, morale, terrain_type, defender_unit=None, is_mandatory_attack=False, event_civi_active=False):
        """
        Calculates preliminary AV and DV based on units and modifiers.
        
        Args:
            attacker_units (list): List of US units participating. (Must contain 'is_lead' or assumed first is lead)
            support_modifiers (dict): {'artillery': count, 'engineer': count, 'air_support': bool}
            morale (int): US Morale
            terrain_type (str): 'Urban', 'Fort', 'Clear'
            defender_unit (dict): JP unit dict, can be None (Unrevealed default)
            is_mandatory_attack (bool): Flag
            event_civi_active (bool): Flag
            
        Returns:
            dict: { "av": int, "dv": int, "logs": list }
        """
        logs = []
        av = 0
        dv = 0
        
        # --- AV Calculation ---
        lead_unit = next((u for u in attacker_units if u.get('is_lead')), attacker_units[0] if attacker_units else None)
        if not lead_unit:
            return {"av": 0, "dv": 0, "logs": ["No attacking units"]}
            
        # Base AV (Lead Unit)
        # Assuming 'attack_factor' exists, default 2?
        base_av = lead_unit.get('attack_factor', 2) # Fallback 2
        av += base_av
        logs.append(f"AV Base (Lead {lead_unit.get('name')}): {base_av}")
        
        # Additional Units (+1 each)
        additional_count = len(attacker_units) - 1
        # Check if any is HQ (HQ doesn't add unless commanding, but rule says "Main unit + others". HQ as 'other' usually +0 or +1?
        # Rule: "Additional units ... +1 each. HQ provides +1 if commanding (implied yes)".
        # Logic: Simply Count - 1.
        if additional_count > 0:
            av += additional_count
            logs.append(f"AV Additional Units (+{additional_count}): Total {len(attacker_units)} units")
            
        # Support
        arty_count = support_modifiers.get('artillery', 0)
        eng_count = support_modifiers.get('engineer', 0)
        
        # Limit check: Total support markers <= Total Units
        total_support = arty_count + eng_count
        if total_support > len(attacker_units):
            logs.append(f"WARNING: Support ({total_support}) exceeds Unit count ({len(attacker_units)}). Excess ignored (logic not enforcing strict removal, just caps effect?)")
            # For calculation, we might need to clamp. Usually user UI prevents this. 
            # We assume valid input or clamp here.
            # Let's simple warn.
            
        av += arty_count * 1
        av += eng_count * 2
        if total_support > 0:
            logs.append(f"AV Support: Arty x{arty_count} (+{arty_count}), Eng x{eng_count} (+{eng_count*2})")
            
        # Combined Arms
        # Need Tank AND Infantry AND (Eng OR Arty)
        has_tank = any(u.get('type') in ['Armor', 'Tank'] for u in attacker_units)
        has_inf = any(u.get('type') in ['Infantry', 'infantry'] for u in attacker_units) # Check case
        has_support = total_support > 0
        
        if has_tank and has_inf and has_support:
            av += 1
            logs.append("AV Combined Arms Bonus: +1")
            
        # Strong Morale
        if morale >= 10:
            av += 1
            logs.append(f"AV Strong Morale ({morale}): +1")
            
        # Devents (Civilians)
        if event_civi_active and is_mandatory_attack:
            av -= 1
            logs.append("AV Penalty (Civilians & Mandatory): -1")

        # --- Parent Formation Penalty (Rule 11.5) ---
        # Identify formations based on ID prefixes
        # 37th Inf: "37_"
        # 1st Cav: "1C_"
        # 11th Abn: "11-"
        formations = set()
        for u in attacker_units:
            uid = u.get('id', '')
            if uid.startswith('37_'):
                formations.add('37th')
            elif uid.startswith('1C_'):
                formations.add('1st')
            elif uid.startswith('11-'):
                formations.add('11th')
            # HQ Whitcomb (37_Whitcomb) -> 37th
            # HQ Chase (1C_Chase) -> 1st
            # HQ Haugen (11-Haugen) -> 11th
            # Logic holds for HQs as well.
        
        n_formations = len(formations)
        if n_formations > 1:
            penalty = -(n_formations - 1)
            av += penalty
            logs.append(f"AV Parent Formation Penalty: {penalty} (Mixed {', '.join(formations)})")
            
        # --- DV Calculation ---
        # Base Defender DF
        base_df = 0
        if defender_unit:
            base_df = defender_unit.get('defense_factor', 3) # Default 3 if unknown?
        else:
            base_df = 3 # Unknown unit default assumption? Or 0?
            
        dv += base_df
        logs.append(f"DV Base ({defender_unit.get('name') if defender_unit else '??'}): {base_df}")
        
        # Terrain
        t_mod = 0
        if terrain_type == 'Urban': t_mod = 3
        elif terrain_type == 'Fort': t_mod = 4
        elif terrain_type == 'Clear': t_mod = 2
        
        dv += t_mod
        logs.append(f"DV Terrain ({terrain_type}): +{t_mod}")
        
        # Shaken Morale (US Morale <= 9 -> JP +1)
        if morale <= 9:
            dv += 1
            logs.append(f"DV Shaken Bonus (US Morale {morale}): +1")
            
        # Air Support (Logic handled in process_combat via dice, but maybe display note)
        if support_modifiers.get('air_support'):
            logs.append("DV Air Support: Will reduce DV by 1d6 during resolution")
            
        # Elite (Logic handled in resolution 3d6 drop low)
        if defender_unit and defender_unit.get('is_elite'):
            logs.append("DV Elite: Will roll 3d6 (drop lowest) for Defense")
            
        return {
            "av": av,
            "dv": dv,
            "logs": logs
        }

    def process_combat(self, attack_val, defense_val, terrain_mod, strategy_mod, is_night_attack=False, is_elite=False, has_air_support=False):
        """
        Executes Combat Resolution (AT vs DT).
        Updated to handle Elite dice (3d6 drop low) and Air Support (DV -1d6).
        """
        logs = []
        
        # Roll 2d6 for Attack
        d1, d2 = random.randint(1, 6), random.randint(1, 6)
        at_roll = d1 + d2
        at_total = attack_val + at_roll
        
        logs.append(f"Combat Resolution:")
        logs.append(f"  US Attack: AV {attack_val} + Roll {at_roll} ({d1}+{d2}) = {at_total}")
        
        # Defense logic
        # 1. Air Support Reduction
        air_reduction = 0
        if has_air_support:
            air_roll = random.randint(1, 6)
            air_reduction = air_roll
            logs.append(f"  Air Support: DV Reduced by {air_roll} (Roll 1d6)")
            
        # 2. Defense Roll (Normal 2d6 or Elite 3d6 drop low)
        dt_roll = 0
        if is_elite:
            # Roll 3d6
            rolls = [random.randint(1, 6) for _ in range(3)]
            rolls.sort() # low to high
            # Drop lowest (index 0)
            kept = rolls[1:]
            dt_roll = sum(kept)
            logs.append(f"  JP Elite Defense: Rolls {rolls} -> Drop {rolls[0]} -> Keep {kept} = {dt_roll}")
        else:
            d3, d4 = random.randint(1, 6), random.randint(1, 6)
            dt_roll = d3 + d4
            logs.append(f"  JP Defense Roll: {dt_roll} ({d3}+{d4})")
            
        # Calculate Final DT
        # Note: defense_val input commonly includes BaseDF. 
        # terrain_mod and strategy_mod are additional.
        # process_combat expects 'defense_val' to be the base or subtotal?
        # In this implementation, let's treat them as additive components.
        
        raw_dv = defense_val + terrain_mod + strategy_mod
        final_dv = raw_dv - air_reduction
        if final_dv < 0: final_dv = 0 # Cannot be < 0
        
        dt_total = final_dv + dt_roll
        
        logs.append(f"  JP Defense Total: (Base+Mods {raw_dv} - Air {air_reduction}) + Roll {dt_roll} = {dt_total}")
        
        diff = at_total - dt_total
        is_success = diff > 0
        is_overrun = False
        
        # Overrun Condition: (AT - DT) > Defender Base DF
        # We need the 'Base DF' to compare. 
        # Ideally, `defense_val` passed here IS the Base DF?
        # If the caller passed (BaseDF + StaticMods) as defense_val, we might simulate Base DF.
        # Let's assume `defense_val` passed by caller IS Base DF (e.g. 3-10).
        # And Mods are passed in separate args (terrain_mod, strategy_mod).
        # If so, diff > defense_val check is correct.
        
        if is_success:
            if diff > defense_val: # Compare against Base DF
                is_overrun = True
                logs.append(f"  Result: OVERRUN! (Diff {diff} > Base DF {defense_val})")
            else:
                logs.append(f"  Result: Success (JP Eliminated)")
        else:
             logs.append(f"  Result: Failed (Stalemate/Repulse)")
             
        return {
            "at_roll": at_roll,
            "dt_roll": dt_roll,
            "at_total": at_total,
            "dt_total": dt_total,
            "diff": diff,
            "is_success": is_success,
            "is_overrun": is_overrun,
            "logs": logs
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

    def apply_combat_result(self, result_type, attacker_units, defender_unit, target_area, current_morale, strategy_casualty_ids=None):
        """
        Applies the combat result to units and game state.
        
        Args:
            result_type (str): 'Repulse', 'Stalemate', 'Success', 'Overrun'
            attacker_units (list): List of attacking units (dicts). Must identify 'is_lead'.
            defender_unit (dict): Defending unit dict.
            target_area (str): Name of the area.
            current_morale (int): Current US Morale.
            strategy_casualty_ids (list): List of unit IDs removed by strategy (Ambush etc) BEFORE combat.
            
        Returns:
            dict: {
                "updated_attacker_units": list,
                "updated_defender_unit": dict, # or None if eliminated? Better return dict with status updated.
                "new_morale": int,
                "area_update": dict, # { "control": "US" } or null
                "logs": list
            }
        """
        logs = []
        updated_attackers = []
        # Convert attacker_units to a dict for easier updates by ID
        units_by_id = {u['id']: u.copy() for u in attacker_units} 
        
        updated_defender = defender_unit.copy() if defender_unit else None
        new_morale = current_morale
        area_update = {}

        # --- 0. Apply Pre-Combat Strategy Casualties (Ambush, Sniper, Barrage) ---
        if strategy_casualty_ids:
            for cid in strategy_casualty_ids:
                if cid in units_by_id:
                    u = units_by_id[cid]
                    u['status'] = 'out_of_action'
                    u['location'] = 'OOA'
                    logs.append(f"Strategy Casualty: {u.get('name')} ({u.get('id')}) -> OOA")
        
        # Identify Lead
        # Assuming frontend passes 'is_lead': True in one unit
        
        lead_unit = None
        for uid, u in units_by_id.items():
            if u.get('is_lead') and u.get('status') != 'out_of_action':
                lead_unit = u
                break
        
        logs.append(f"Applying Combat Result: {result_type}")
        
        if result_type == 'StrategyCasualty':
            # Only processing casualties (Ambush/Sniper) immediately
            # Step 0 already handled the status updates for strategy_casualty_ids
            logs.append("  -> Strategy Casualties applied immediately.")
            return {
                "updated_attacker_units": list(units_by_id.values()), # Return all units including updated ones
                "updated_defender_unit": updated_defender, 
                "new_morale": new_morale,
                "area_update": area_update,
                "logs": logs
            }

        if result_type == 'Repulse':
            # 1. Lead Attacker -> OOA
            if lead_unit:
                logs.append(f"  Lead Unit {lead_unit.get('name')} -> OOA")
                lead_unit['status'] = 'out_of_action'
                lead_unit['location'] = 'OOA' 
                
            # 2. Others -> Spent
            # Note: We must iterate all units to add them to updated_attackers list
            for uid, u in units_by_id.items():
                # Check directly if it is the modified lead unit object
                is_lead_processed = (lead_unit and u['id'] == lead_unit['id'])
                
                if not is_lead_processed and u.get('status') != 'out_of_action':
                    u['status'] = 'spent'
                    logs.append(f"  Unit {u.get('name')} -> Spent")
                
                updated_attackers.append(u)
                
            # 3. Morale -1
            new_morale -= 1
            logs.append(f"  Morale: {current_morale} -> {new_morale} (-1)")
            
        elif result_type == 'Stalemate':
            # 1. All Attackers -> Spent (Except OOA)
            for uid, u in units_by_id.items():
                if u.get('status') != 'out_of_action':
                    u['status'] = 'spent'
                updated_attackers.append(u)
            logs.append("  All Attacking Units -> Spent")
            
        elif result_type == 'Success':
            # 1. Defender -> Eliminated
            if updated_defender:
                updated_defender['status'] = 'eliminated'
                updated_defender['location'] = 'Eliminated'
                logs.append(f"  Defender {updated_defender.get('name')} -> Eliminated")
                
            # 2. All Attackers -> Spent (Except OOA)
            for uid, u in units_by_id.items():
                if u.get('status') != 'out_of_action':
                    u['status'] = 'spent'
                updated_attackers.append(u)
            logs.append("  All Attacking Units -> Spent")

            
            # 3. Control Marker
            area_update = {"control": "US"}
            logs.append(f"  Area {target_area} -> US Control")
            
        elif result_type == 'Overrun':
            # 1. Defender -> Eliminated
            if updated_defender:
                updated_defender['status'] = 'eliminated'
                updated_defender['location'] = 'Eliminated'
                logs.append(f"  Defender {updated_defender.get('name')} -> Eliminated")
                
            # 2. All Attackers -> Fresh (Maintain)
            # No change to status
            updated_attackers = attacker_units # Copy?
            logs.append("  Overrun! All Attacking Units remain Fresh.")
            
            # 3. Control Marker
            area_update = {"control": "US"}
            logs.append(f"  Area {target_area} -> US Control")
            
        return {
            "updated_attacker_units": updated_attackers,
            "updated_defender_unit": updated_defender,
            "new_morale": new_morale,
            "area_update": area_update,
            "logs": logs
        }
