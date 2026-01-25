import subprocess
import sys
import os
import time
import signal

def run():
    print("Starting Manila: Savage Streets, 1945 Development Environment...")
    
    # Determine pnpm command based on OS
    pnpm_cmd = "pnpm.cmd" if os.name == 'nt' else "pnpm"
    
    # Verify pnpm exists (optional, simply try running it)
    
    # Start Backend
    print("Starting Backend (FastAPI)...")
    backend = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "main:app", "--reload", "--port", "8000"],
        cwd="backend"
    )

    # Start Frontend
    print("Starting Frontend (Vite)...")
    # Using shell=True for better compatibility with npm/pnpm on Windows
    frontend = subprocess.Popen(
        f"{pnpm_cmd} run dev",
        cwd="frontend",
        shell=True
    )

    print("\n-----------------------------------------------------")
    print("Frontend running at: http://localhost:5173")
    print("Backend usage: Direct API at http://localhost:8000")
    print("-----------------------------------------------------\n")

    try:
        while True:
            time.sleep(1)
            if backend.poll() is not None:
                print("Backend process ended unexpectedly.")
                break
            if frontend.poll() is not None:
                print("Frontend process ended unexpectedly.")
                break
    except KeyboardInterrupt:
        print("\nStopping services...")
        backend.terminate()
        # On Windows, terminating shell=True process tree can be tricky, 
        # but basic terminate should work for simple dev usage.
        frontend.terminate()
        
if __name__ == "__main__":
    run()
