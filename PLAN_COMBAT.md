## Phase 4: Combat Phase Implementation Plan

The Combat Phase is the core of "Manila: Savage Streets 1945". It involves an impulse-based system where players alternate activating areas to move and fight.

### 1. Impulse System & State Management
- **State Check**: `currentImpulse` (US or JP).
- **Activation**:
  - Player selects an Area to "Activate".
  - Area must be "Fresh" (not Spent).
  - Activating an area marks all units in it as "Activated".
- **Actions**:
  - **Move**: Units in activated area can move to adjacent areas.
    - Movement costs (1 MP normally, +1 for crossing streams/ridges).
    - Entering an enemy-occupied area (Close Combat) costs all MP.
  - **Fire**: Units can fire at adjacent areas.
    - Fire Value = Sum of Combat Factors.
    - Shifts: Terrain, Combined Arms, Prep Fire.
  - **Pass**: If a player passes, impulse goes to opponent. If both pass consecutively, phase ends.
- **Spent Status**: After activation, units/area are marked "Spent".

### 2. Backend Logic (game_logic.py)
- `process_activation(area_id)`: Mark area as active.
- `process_movement(unit_id, from_area, to_area)`:
  - Validate adjacency.
  - Validate MP cost.
  - Handle "Infiltration" (US moving into Japanese occupied area).
- `process_combat(attacker_ids, target_area_id)`:
  - Calculate Attack Value (AV).
  - Calculate Defense Value (DV) (Terrain dependent).
  - Apply Column Shifts (Combined Arms, etc.).
  - Roll 2d6 (Attacker) vs 1d6 (Defender, derived from CRT or simplified mechanics depending on rules).
  - Apply results (Elimination, Retreat, Step Loss).

### 3. Frontend Interactions
- **Area Selection**: Highlight valid areas for activation.
- **Unit Drag & Drop**: For movement.
- **Target Selection**: Right-click enemy area to "Fire".
- **Combat Resolution Window**: Pop-up showing the calculation and roll button.

### 4. Special Rules
- **Bloody Streets (Rule 8.0)**:
  - At start of Combat Phase, check "Contested Areas" (both sides present).
  - Roll 1d6 for each side. On 6, taking a step loss.
- **Combined Arms**:
  - Tank + Infantry stack benefit.

### Steps
1. **Bloody Streets Implementation**: Automatic check at start of phase.
2. **Impulse Loop Infrastructure**: Backend endpoint to handle "Pass" and "Activate".
3. **Movement Implementation**: Drag & drop with validation.
4. **Combat Engine**: The 2d6 CRT logic.
