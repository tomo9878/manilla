
# Implementation Summary: Combat Mechanics & Unit Data

## 1. Unit Data Refinement (`units_data.json`)
We have completed the comprehensive update of US unit statistics (Attack / Movement) for all major formations.

*   **37th Infantry Division**:
    *   Infantry Battalions (129th, 145th, 148th): Attack 4, Move 6.
    *   637th Tank Destroyer Bn (A, B, C): Attack 6, Move 6.
    *   HQs (Fredrick, Whitcomb, White): Attack 0, Move 6.
*   **1st Cavalry Division**:
    *   Cavalry Regiments (5th, 12th, 7th, 8th): Attack 5, Move 6.
    *   44th Tank Bn (A, B): Attack 7, Move 6.
    *   44th Tank Bn (D): Attack 5, Move 7 (Light Tanks).
    *   302nd RCN: Attack 3, Move 8.
    *   HQs (Chase, Hoffman): Attack 0, Move 6.
*   **11th Airborne Division**:
    *   511th/187th/188th Infantry: Attack 4, Move 4.
    *   HQs (Haugen, Soule, Hildebrand): Attack 0, Move 6.
*   **Reinforcements**:
    *   754th Tank Bn (A, B): Attack 7, Move 6 (Start Areas 1 & 2).

All US units are now compliant with `attack` and `movement` properties required for game logic.

## 2. Backend Logic (`game_logic.py`)
Implemented key combat rules and modifiers.

### A. Combined Arms Bonus (Rule 11.4)
*   **Condition**: Presence of **Infantry**, **Tank**, AND **Support** (Artillery or Engineer).
*   **Effect**: +1 to Attack Value (AV).
*   **Implementation**: Logic checks the `type` of participating units and the presence of support markers.

### B. Parent Formation Penalty (Rule 11.5)
*   **Condition**: Mixing units from different parent formations (37th, 1st Cav, 11th Abn) in a single attack.
*   **Effect**: Penalty to AV equal to `-(Number of Formations - 1)`.
    *   2 Formations mixed: -1 AV.
    *   3 Formations mixed: -2 AV.
*   **Implementation**: Logic identifies parent formation via Unit ID prefixes (`37_`, `1C_`, `11-`) and calculates the penalty dynamically.

### C. Combat Resolution
*   **Support**: Artillery (+1), Engineer (+2).
*   **Morale**: Checks for "Strong Morale" bonus (implementation pending specific threshold confirmation, currently placeholder).
*   **Result**: Calculates `AT - DT` differential to determine Success, Repulse, or Overrun.

## 3. Frontend UI (`CombatModal.jsx`)
Enhanced the Combat Modal to support tactical decisions.

### A. Participation Toggle
*   **Feature**: Players can toggle specific units' participation in combat using checkboxes.
*   **Behavior**: Validates that the **Lead Unit** cannot be deselected.
*   **Visuals**: Inactive units are dimmed.

### B. Real-time Feedback
*   **Dynamic Calculation**: Toggling units immediately sends a request to the backend to recalculate `Total AV`.
*   **Warning System**: A warning message ("⚠️ Mixed Formation Penalty Active") appears instantly when the selection triggers the Parent Formation Penalty.
*   **Support Limits**: The maximum number of allowed support markers dynamically adjusts based on the number of *participating* units.

## 4. Verification
White-box testing scripts were created to verify the logic:
*   `test_combined_arms.py`: Confirmed correct application of the +1 bonus when conditions are met.
*   `test_parent_penalty.py`: Confirmed correct calculation of the penalty when multiple formations are mixed, and verified interaction with other bonuses.

---
**Status**: Combat mechanics for the US side are largely complete and verified. Next steps would typically involve resolving the "Defender Strategy" details or advancing the Turn Sequence logic.
