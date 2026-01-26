
import os

def fix_app():
    path = 'frontend/src/App.jsx'
    with open(path, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    # 1. Truncate garbage at the end
    # Find the LAST occurrence of 'export default App;' ideally, but there should be only one valid one.
    # The garbage one I added didn't have export default? 
    # The garbage started with 'import CombatMock'.
    # I'll look for 'export default App;' and keep it, discarding anything subsequent that looks like my garbage.
    
    # Actually, I can just look for the FIRST 'export default App;' (around line 1528) and truncate after it?
    # But wait, does 'export default App' appear earlier? No, typically at end.
    
    export_idx = -1
    for i in range(len(lines)):
        if lines[i].strip() == 'export default App;':
            export_idx = i
            # Don't break immediately, in case multiple? But file showed one at 1528.
            # I trust 1528 is the one I want to keep.
            
    if export_idx != -1:
        # Keep up to export_idx + 1 (empty line usually) can stay.
        # But specifically remove the appended stuff.
        lines = lines[:export_idx+1]
        print(f"Truncated file at line {export_idx+1}")
    else:
        print("Warning: export default App; not found?")

    # 2. Add Imports if not present
    has_import = any('import CombatMock' in line for line in lines)
    if not has_import:
        # Find last import
        insert_idx = 0
        for i, line in enumerate(lines):
            if line.startswith('import '):
                insert_idx = i
        
        lines.insert(insert_idx + 1, "import CombatMock from './CombatMock';\n")
        lines.insert(insert_idx + 2, "\n// --- MOCK MODE TOGGLE ---\nconst SHOW_COMBAT_MOCK = true;\n")
        print("Added Import and Constant")

    # 3. Inject logic into App function
    # Look for 'function App() {'
    app_func_idx = -1
    for i, line in enumerate(lines):
        if 'function App() {' in line:
            app_func_idx = i
            break
            
    if app_func_idx != -1:
        # Check if logic already exists (avoid double inject if re-run)
        if 'SHOW_COMBAT_MOCK' not in lines[app_func_idx + 1]:
            lines.insert(app_func_idx + 1, "    if (SHOW_COMBAT_MOCK) return <CombatMock />;\n")
            print("Injected Mock Logic into App()")

    with open(path, 'w', encoding='utf-8') as f:
        f.writelines(lines)
        
if __name__ == '__main__':
    fix_app()
