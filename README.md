# Manila: Savage Streets, 1945 - Digital Board Game

## Setup Instructions

### 1. Prerequisites
- **Node.js**: Ensure Node.js is installed.
- **Python**: Ensure Python 3.x is installed.
- **pnpm**: This project requires `pnpm`. If not installed:
  ```bash
  npm install -g pnpm
  # Or enable via Corepack
  corepack enable
  ```

### 2. Install Dependencies

#### Backend (Python)
Navigate to the root directory and install Python dependencies (creating a virtual environment is recommended).
```bash
cd backend
python -m venv venv
# Activate venv:
# Windows: venv\Scripts\activate
# Linux/Mac: source venv/bin/activate

pip install -r requirements.txt
cd ..
```

#### Frontend (React + Vite)
Navigate to the frontend directory and install dependencies using pnpm.
```bash
cd frontend
pnpm install
cd ..
```

### 3. Run Development Server
From the root directory, run the development script. This will start both the FastAPI backend and the Vite frontend.

```bash
python dev.py
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:8000
