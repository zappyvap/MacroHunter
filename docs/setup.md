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

# Local Machine IP (for mobile Expo Go testing)
# Run `ifconfig` (macOS/Linux) or `ipconfig` (Windows) to find your LAN IP
HOST_IP="your_local_ip"
EXPO_PUBLIC_HOST_IP="your_local_ip"
```

> **Note:** `HOST_IP` and `EXPO_PUBLIC_HOST_IP` should be set to your machine's local network IP (e.g., `192.168.1.x` or `10.0.0.x`). The frontend uses `EXPO_PUBLIC_HOST_IP` to connect to the backend's SSE endpoints. Docker Compose uses `HOST_IP` for the Expo packager hostname. If running locally without Docker and this variable is not set, the frontend falls back to a hardcoded default in the source code — update it in `macrohunter-frontend/src/app/index.js` and `scan.js` if needed.

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

The cache uses `restaurant_name` (lowercase, trimmed) as the primary key and stores the full menu as JSONB. Entries are considered stale after 7 days (`CACHE_MAX_AGE_DAYS` in `chain_reader.py`).

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

> **Note:** Update `HOST_IP` in your `.env` file to your machine's local IP if you want to test on a physical device. This value is used for both `REACT_NATIVE_PACKAGER_HOSTNAME` and `EXPO_PUBLIC_HOST_IP` in the Docker Compose configuration.

### Docker Details

| Service | Image Base | Key Details |
|---|---|---|
| `engine` | `python:3.11-slim` | Installs `coinor-cbc` for PuLP, mounts `./mcp_servers` at `/app/mcp_servers` |
| `scanner` | `python:3.11-slim` | Installs `coinor-cbc` for PuLP, runs `image_scraper:app` on port 8001 |
| `expo-app` | `node:20-alpine` | Runs with `--host lan --go`, exposes ports 8081/19000/19001 |

> **Note:** The backend Dockerfile's default CMD references `main:app`, but `docker-compose.yml` overrides this to `uvicorn engine:app --host 0.0.0.0 --port 8000 --reload`. Always launch via `docker compose up`.

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
source .venv/bin/activate  # macOS/Linux
# .venv\Scripts\activate   # Windows

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

### Unit Tests

```bash
cd backend
python -m pytest tests/ -v
```

This runs all unit tests **except** end-to-end accuracy tests (which hit real APIs). The `conftest.py` file adds a `--e2e` flag that controls whether accuracy tests run.

### End-to-End Accuracy Tests

```bash
cd backend
python -m pytest tests/ -v --e2e
```

The `--e2e` flag enables tests marked with `@pytest.mark.e2e`, which hit real external APIs (USDA FoodData Central, FatSecret, Gemini). These tests require valid API keys in your `.env` file.

### Test Files

| File | Description |
|---|---|
| `conftest.py` | Adds `--e2e` pytest flag; skips e2e-marked tests by default |
| `test_ingredient_analyzer.py` | Unit tests for ingredient weight parsing and USDA macro lookup |
| `test_chain_reader.py` | Tests for FatSecret integration, menu normalization, and AI estimation |
| `test_engine.py` | API endpoint tests (request validation, error handling, mock graph responses) |
| `test_accuracy_e2e.py` | End-to-end accuracy tests comparing pipeline output to ground truth macros |

---

## Running Benchmarks

The project includes a comprehensive benchmarking system for measuring pipeline performance and macro accuracy.

### Pipeline Timing Benchmark

```bash
# From the project root (with venv active)

# Default: 3 runs, search path, NYC location (40.7128, -74.0060)
python benchmark.py

# Custom number of runs
python benchmark.py --runs 5

# Custom location
python benchmark.py --lat 42.35 --lon -71.06

# Custom macro targets
python benchmark.py --calories 800 --protein 50 --carbs 60 --fats 30

# Vision mode (requires a menu image)
python benchmark.py --mode vision --image path/to/menu.jpg
```

The benchmark:
1. Fires the LangGraph pipeline directly in-process (no HTTP overhead)
2. Collects per-node wall-clock timings across all runs
3. Prints a summary table with mean/min/max/stdev per node
4. Automatically prepends results to `benchmark_history.txt`

### Accuracy Testing

```bash
# Run ONLY the accuracy test (bypasses the graph entirely)
python benchmark.py --runs 0 --accuracy

# Run both accuracy + timing benchmark
python benchmark.py --accuracy
```

The accuracy test:
1. Loads ground truth macro data from `accuracy_ground_truth.py` (official nutrition data from restaurant websites)
2. Runs items through the pipeline (FatSecret path or AI estimation path)
3. Uses fuzzy item name matching to map pipeline output to ground truth entries
4. Reports Mean Absolute Percentage Error (MAPE) per macro per restaurant
5. Shows detailed per-item comparison for items with >15% error

#### Ground Truth Data

Ground truth is defined in `accuracy_ground_truth.py` and currently includes:
- **McDonald's** (FatSecret path) — 7 items from official nutrition calculator
- **Chick-fil-A** (FatSecret path) — 4 items from official nutrition data
- **McDonald's AI** (AI estimation path) — same 6 items run through Gemini + USDA instead of FatSecret

---

## Python Dependencies

Both `backend/requirements.txt` and `mcp_servers/requirements.txt` contain the same dependencies:

| Category | Packages |
|---|---|
| Web Framework | `fastapi`, `uvicorn` |
| AI Orchestration | `langchain`, `langchain-anthropic`, `langgraph`, `langchain-core`, `langchain-google-genai` |
| MCP | `mcp[cli]>=1.0,<2.0` |
| Optimization | `pulp` |
| AI Client | `google-genai` |
| Image Processing | `pillow` |
| HTTP Client | `httpx` |
| Database | `supabase` |
| Nutrition Data | `usda-fdc` |
| Configuration | `python-dotenv` |

### Frontend Dependencies

Key npm packages (see `macrohunter-frontend/package.json`):

| Package | Version | Purpose |
|---|---|---|
| `expo` | ~54.0.34 | Expo SDK |
| `react` | 19.1.0 | React core |
| `react-native` | 0.81.5 | React Native core |
| `expo-router` | ~6.0.24 | File-based routing |
| `expo-location` | ~19.0.8 | GPS access |
| `expo-image-picker` | ~17.0.11 | Camera/gallery access |
| `react-native-sse` | ^1.2.1 | EventSource polyfill for SSE |
| `react-native-svg` | ^15.12.1 | SVG rendering |
| `react-native-web` | ^0.21.2 | Web export |
| `@expo-google-fonts/inter` | ^0.4.2 | Inter font family |
| `@expo-google-fonts/montserrat` | ^0.4.2 | Montserrat font family |

---

## Project Structure

```
MacroHunter/
├── .env                          # API keys (git-ignored)
├── .gitignore
├── docker-compose.yml            # 3-service container setup
├── README.md
├── benchmark.py                  # Pipeline timing + accuracy benchmark
├── accuracy_ground_truth.py      # Ground truth macro data for accuracy testing
├── benchmark_history.txt         # Timestamped benchmark run history
├── .github/
│   └── workflows/
│       └── daily-caching.yml     # Bi-weekly automated cache warming
├── docs/                         # Project documentation
│   ├── architecture.md
│   ├── workflows.md
│   ├── api-reference.md
│   └── setup.md
├── backend/                      # FastAPI engine + LangGraph
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── engine.py                 # API endpoints (SSE streaming)
│   ├── graph.py                  # LangGraph state machine
│   ├── scripts/
│   │   └── caching-script.py     # Automated cache warming for Supabase
│   └── tests/
│       ├── conftest.py           # --e2e flag for accuracy tests
│       ├── test_ingredient_analyzer.py
│       ├── test_chain_reader.py
│       ├── test_engine.py
│       └── test_accuracy_e2e.py
├── mcp_servers/                  # MCP tool modules
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── __init__.py
│   ├── calorie_optimizer.py      # PuLP linear programming
│   ├── chain_reader.py           # FatSecret + Gemini menu fetch + cache
│   ├── image_scraper.py          # Gemini Vision menu scanner (FastAPI)
│   ├── ingredient_analyzer.py    # USDA FDC macro calculator
│   ├── judge.py                  # Result ranking
│   ├── restaurant_finder.py      # Google Places search
│   └── supabase_client.py        # Shared Supabase connection
└── macrohunter-frontend/         # Expo React Native app
    ├── Dockerfile
    ├── package.json
    ├── app.json                  # Expo configuration
    ├── index.js                  # Expo Router entry point
    └── src/
        ├── App.js                # Legacy monolithic version (pre-refactor)
        ├── app/
        │   ├── _layout.js        # Root layout (SearchProvider + fonts + header)
        │   ├── index.js          # Home screen (macro inputs + search/scan)
        │   ├── results.js        # Results screen (cards + lightbox + filters)
        │   ├── scan.js           # Scan screen (animated scan overlay + SSE)
        │   └── auth/
        │       └── login.js      # Auth placeholder (future feature)
        ├── constants/
        │   ├── colors.js         # Color palette (dark theme tokens)
        │   ├── component-style.js # className-to-StyleSheet wrapper components
        │   └── styles.js         # Master StyleSheet definitions
        └── context/
            └── SearchContext.js   # Global search results + scan payload state
```
