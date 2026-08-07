# Setup & Development Guide

## Prerequisites

- **Python 3.11+**
- **Node.js 18+** and npm
- **Docker** and Docker Compose (for containerized setup)
- **Expo CLI** (`npx expo` — installed automatically via npx)

---

## Environment Variables

Create a `.env` file in the project root with the following keys:

```env
# FatSecret API (OAuth 2.0 Client Credentials)
FATSECRET_CLIENT_ID="your_client_id"
FATSECRET_CLIENT_SECRET="your_client_secret"

# Google Gemini AI
GEMINI_API_KEY="your_gemini_api_key"

# Google Places
GOOGLE_API_KEY="your_google_api_key"

# USDA FoodData Central
USDA_API_KEY="your_usda_api_key"

# Supabase (menu caching)
SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_KEY="your_supabase_key"
```

### Where to Get API Keys

| Service | URL | Tier |
|---|---|---|
| FatSecret | [platform.fatsecret.com](https://platform.fatsecret.com) | Free |
| Gemini | [aistudio.google.com](https://aistudio.google.com/apikey) | Free tier available |
| Google Places | [console.cloud.google.com](https://console.cloud.google.com) | Free $200/month credit |
| USDA FDC | [fdc.nal.usda.gov](https://fdc.nal.usda.gov/api-guide.html) | Free |
| Supabase | [supabase.com](https://supabase.com) | Free tier available |

### Supabase Table Setup

Create a `menu_cache` table in your Supabase project:

```sql
CREATE TABLE menu_cache (
  restaurant_name TEXT PRIMARY KEY,
  menu JSONB NOT NULL,
  cached_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## Option 1: Docker Compose (Recommended)

This spins up all three services in containers.

```bash
# From the project root
docker compose up --build
```

| Service | URL |
|---|---|
| Backend Engine | `http://localhost:8000` |
| Image Scanner | `http://localhost:8001` |
| Expo App | `http://localhost:8081` |

> **Note:** Update `REACT_NATIVE_PACKAGER_HOSTNAME` in `docker-compose.yml` to your machine's local IP if you want to test on a physical device.

### Rebuilding After Changes

```bash
# Rebuild a specific service
docker compose up --build engine

# Rebuild all
docker compose up --build
```

---

## Option 2: Local Development (Without Docker)

### Backend

```bash
cd backend

# Create and activate virtual environment
python -m venv .venv
.venv\Scripts\activate     # Windows
# source .venv/bin/activate  # macOS/Linux

# Install dependencies
pip install -r requirements.txt

# Start the engine
uvicorn engine:app --host 0.0.0.0 --port 8000 --reload
```

### Image Scanner

```bash
cd mcp_servers

# Uses the same venv/dependencies as the backend
uvicorn image_scraper:app --host 0.0.0.0 --port 8001 --reload
```

### Frontend

```bash
cd macrohunter-frontend

# Install dependencies
npm install

# Start Expo dev server
npx expo start --web    # Browser
npx expo start          # Mobile (scan QR code with Expo Go)
```

---

## Running Tests

Tests are located in `backend/tests/`. Run with pytest:

```bash
cd backend
python -m pytest tests/ -v
```

### Test Files

| File | Description |
|---|---|
| `test_ingredient_analyzer.py` | Unit tests for ingredient weight parsing and USDA macro lookup |
| `test_chain_reader.py` | Tests for FatSecret integration and menu normalization |
| `test_accuracy_e2e.py` | End-to-end accuracy tests comparing optimized results to known values |

---

## Project Structure

```
MacroHunter/
├── .env                          # API keys (git-ignored)
├── .gitignore
├── docker-compose.yml            # 3-service container setup
├── README.md
├── docs/                         # Project documentation
│   ├── architecture.md
│   ├── workflows.md
│   ├── api-reference.md
│   └── setup.md
├── backend/                      # FastAPI engine + LangGraph
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── engine.py                 # API endpoints
│   ├── graph.py                  # LangGraph state machine
│   └── tests/
│       ├── conftest.py
│       ├── test_ingredient_analyzer.py
│       ├── test_chain_reader.py
│       └── test_accuracy_e2e.py
├── mcp_servers/                  # MCP tool modules
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── calorie_optimizer.py      # PuLP linear programming
│   ├── chain_reader.py           # FatSecret + Gemini menu fetch
│   ├── image_scraper.py          # Gemini Vision menu scanner
│   ├── ingredient_analyzer.py    # USDA FDC macro calculator
│   ├── judge.py                  # Result ranking
│   ├── restaurant_finder.py      # Google Places search
│   └── supabase_client.py        # Shared Supabase connection
└── macrohunter-frontend/         # Expo React Native app
    ├── Dockerfile
    ├── package.json
    ├── app.json
    ├── index.js
    └── src/
        ├── App.js                # Web-only single-screen version (legacy)
        ├── app/
        │   ├── _layout.js        # Root layout (SearchProvider wrapper)
        │   ├── index.js          # Home screen (macro inputs + search/scan)
        │   ├── results.js        # Results screen (cards + lightbox)
        │   └── scan.js           # Scanning screen (image preview)
        ├── constants/
        │   ├── colors.js         # Color palette
        │   ├── component-style.js # className-to-style wrappers
        │   └── styles.js         # StyleSheet definitions
        └── context/
            └── SearchContext.js   # Global search results state
```
