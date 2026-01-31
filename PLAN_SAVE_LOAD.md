# Save/Load Functionality Design Plan

## 1. Overview
Implement a robust Save and Load system to allow players to pause and resume their game. Since the backend is stateless (logic-only), the **Frontend State** acts as the single source of truth. Therefore, saving the game means serializing the frontend state to a JSON file (or LocalStorage).

## 2. Data Structure (Schema)
The save file (`manila_save_*.json`) will contain the following root objects:

```json
{
  "version": "1.0",
  "timestamp": "2026-01-31T12:00:00.000Z",
  "gameState": {
    "turn": 1,
    "currentPhase": "Action",
    "morale": 19,
    "supplyPoints": 0,
    "usControlledAreas": ["Area 1", "Area 2", ...],
    "units": [
      {
        "id": "1C_1-12",
        "x": 100,
        "y": 200,
        "status": "fresh", // fresh, spent, out_of_action, eliminated, revealed
        "location": "Area 1",
        "faction": "US",
        // ...static properties (name, images) are optional but safer to include for consistency
      },
      // ...all US and JP units
    ],
    "supportUnits": {
      "artillery": { "available": 2, "used": 0, "max": 6, ... },
      "engineer": { ... },
      "air": { ... }
    },
    "currentEvent": null, // or Event Object
    "supplyRolled": true, // Flag for supply phase
    "hasBeenShaken": false // Flag for Air Support unlock
  }
}
```

## 3. Implementation Strategy

### A. Save (Export)
- **Trigger**: "Save Game" button in the Sidebar.
- **Action**: 
  1. Collect all relevant React State variables (`turn`, `units`, `morale`, etc.).
  2. Create the JSON object.
  3. Trigger a browser download of the stringified JSON as a file.
  - **Filename**: `manila_save_Turn{turn}_{timestamp}.json`

### B. Load (Import)
- **Trigger**: "Load Game" button in the Sidebar (opens File Picker).
- **Action**:
  1. Read the selected JSON file.
  2. Validate the version/structure (basic check).
  3. **Batch Update** State:
     - `setTurn(...)`
     - `setUnits(...)`
     - `setMorale(...)`
     - etc.
  4. Display "Game Loaded" notification.

### C. Auto-Save (LocalStorage) - *Optional/Nice-to-have*
- **Trigger**: At the end of every Phase (e.g., `handleEndPhase`).
- **Action**: Save the JSON string to `localStorage.getItem('manila_autosave')`.
- **Resume**: On app launch, check LocalStorage and offer "Resume Game" button.

## 4. UI Components

### Sidebar
Add a "System" section at the bottom:
- `[ Save Game ]` (Download)
- `[ Load Game ]` (Upload Input)
- `[ Reset ]` (Clear board re-initialization)

## 5. Potential Issues & Solutions
- **Image Assets**: The save file relies on the static assets existing in the `/public/images` folder. Since we don't save images themselves, this is fine as long as the asset filenames don't change.
- **Backward Compatibility**: If we change the unit data structure in code, old saves might break. 
  - *Solution*: Add a `version` field. If version mismatch, warn user or attempt migration.
- **Backend Sync**: The backend API doesn't store state, so no need to sync "Save" to backend. However, when Loading, we just replace the frontend state, and subsequent API calls (Combat, Dawn) will naturally use the new state passed in the request body.

## 6. Detailed Tasks
1. **Create Utility Functions**: `exportGameState()`, `importGameState()`.
2. **Add UI Buttons**: In `App.jsx` sidebar.
3. **Implement File Handler**: `<input type="file" />` with `onChange` handler to read JSON.
4. **Testing**: 
   - Start game, move units, change morale.
   - Save.
   - Reload page (Reset).
   - Load file.
   - Verify state is identical.
