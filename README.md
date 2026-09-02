# 🎯 MacroHunter

**AI-Powered Meal Optimization — Find the best meal for your macros at nearby restaurants.**

MacroHunter is a decision support system that solves daily nutrition mathematically. Unlike food trackers (MyFitnessPal), it actively calculates the optimal meal to order based on your remaining macro targets, budget, and location using linear programming and AI.

---

## How It Works

1. **Set your macro targets** — calories, protein, carbs, and fats
2. **Choose your input method:**
   - 📍 **Search nearby** — GPS finds restaurants around you
   - 📸 **Scan a menu** — Take a photo of a physical menu
3. **Watch real-time progress** — SSE streaming shows animated step-by-step updates as the AI pipeline runs
4. **Get optimized orders** — PuLP linear programming finds the cheapest combination of items that hits your macros
5. **Compare results** — Orders are ranked by macro accuracy and cost, viewable as cards with a swipeable lightbox detail view
6. **Filter and sort** — Filter by max price, verified-only sources, or sort by best match, protein, carbs, or fats
7. **Get directions** — Tap to open native maps with directions to any restaurant

---

## Restaurant Search Demo


https://github.com/user-attachments/assets/7fe52a57-2ef7-4187-ad81-41e47ad88ae8

---

## Image Scan Demo



https://github.com/user-attachments/assets/a803765f-b8ea-4f4b-a416-4d2f9ce61a40

---
## Tech Stack

| Layer              | Technology                                     |
| ------------------ | ---------------------------------------------- |
| **Frontend**       | React Native + Expo SDK 54 (iOS, Android, Web) |
| **Backend**        | FastAPI + LangGraph (agentic state machine)     |
| **Streaming**      | Server-Sent Events (SSE) for real-time updates  |
| **AI**             | Gemini 2.5 Flash (vision + text + structured output) |
| **Optimization**   | PuLP (CBC linear programming solver)           |
| **Nutrition Data** | FatSecret API, USDA FoodData Central           |
| **Location**       | Google Places Nearby Search                    |
| **Caching**        | Supabase (Postgres)                            |
| **Deployment**     | Docker Compose (3 services)                    |
| **MCP**            | FastMCP decorators (Anthropic MCP SDK `mcp[cli]>=1.0,<2.0`) |
| **Typography**     | Inter (400/500/600/700) + Montserrat (700/800) via Expo Google Fonts |

---

## Architecture

MacroHunter uses a **LangGraph state machine** to orchestrate multiple MCP tool servers. Two workflows share the same graph:

### Search Path (Restaurant Discovery)

```
START → find_restaurants → fan_out (parallel) → fetch_and_optimize × N → judge → END
```

- Finds up to 15 nearby restaurants via Google Places (configurable via `RESULT_LIMIT`)
- Fetches menus from FatSecret (known chains) or Gemini AI estimation + USDA lookup (local restaurants)
- Runs the PuLP solver in parallel for each restaurant
- Streams real-time progress updates to the frontend via SSE
- Ranks all results by macro accuracy (scored as `max(0, 100 - totalGap)`) and cost

### Vision Path (Menu Scan)

```
START → image_translation → optimize_calories → judge → END
```

- Sends menu photo to Gemini Vision for item + ingredient extraction
- Calculates macros via USDA FoodData Central ingredient analysis
- Runs the PuLP solver up to 3 times to generate diverse order options
- Streams scanning progress to a dedicated animated scan screen

---

## Quick Start

### Prerequisites

- Python 3.11+, Node.js 18+, Docker

### 1. Clone and configure

```bash
git clone <repository-url>
cd MacroHunter
# Create a .env file in the project root with your API keys
# See docs/setup.md for the full list of required environment variables
```

### 2. Start with Docker Compose

```bash
docker compose up --build
```

| Service        | URL                     |
| -------------- | ----------------------- |
| Backend Engine | `http://localhost:8000` |
| Image Scanner  | `http://localhost:8001` |
| Expo App       | `http://localhost:8081` |

### 3. Or run locally

```bash
# Backend
cd backend && pip install -r requirements.txt
uvicorn engine:app --host 0.0.0.0 --port 8000 --reload

# Scanner (separate terminal)
cd mcp_servers
uvicorn image_scraper:app --host 0.0.0.0 --port 8001 --reload

# Frontend (separate terminal)
cd macrohunter-frontend && npm install
npx expo start --web
```

> See [docs/setup.md](docs/setup.md) for detailed setup instructions including API key registration.

---

## API Endpoints

All endpoints use **Server-Sent Events (SSE)** for real-time streaming. The frontend receives `agent_update` events during processing and a final `done` event with results.

| Method | Endpoint                          | Description                                          |
| ------ | --------------------------------- | ---------------------------------------------------- |
| `POST` | `/api/optimize-meal`              | Search nearby restaurants and optimize (SSE stream)   |
| `POST` | `/api/optimize-menu-image-stream` | Upload menu photo as base64 JSON and optimize (SSE)   |
| `POST` | `/api/optimize-menu-image`        | Upload menu photo as multipart form-data (SSE, legacy)|

> See [docs/api-reference.md](docs/api-reference.md) for full request/response schemas.

---

## Environment Variables

| Variable                  | Service               | Description                   |
| ------------------------- | --------------------- | ----------------------------- |
| `FATSECRET_CLIENT_ID`     | Chain Reader          | FatSecret OAuth client ID     |
| `FATSECRET_CLIENT_SECRET` | Chain Reader          | FatSecret OAuth client secret |
| `GEMINI_API_KEY`          | Chain Reader, Scanner | Google Gemini API key         |
| `GOOGLE_API_KEY`          | Restaurant Finder     | Google Places API key         |
| `USDA_API_KEY`            | Ingredient Analyzer   | USDA FoodData Central key     |
| `SUPABASE_URL`            | Supabase Client       | Supabase project URL          |
| `SUPABASE_KEY`            | Supabase Client       | Supabase API key              |
| `HOST_IP`                 | Docker Compose        | Local machine IP for Expo Go  |
| `EXPO_PUBLIC_HOST_IP`     | Frontend              | Backend IP for mobile testing  |

---

## Project Structure

```
MacroHunter/
├── backend/                 # FastAPI + LangGraph orchestration
│   ├── engine.py            # API endpoints (SSE streaming)
│   ├── graph.py             # Agentic state machine
│   ├── Dockerfile           # Python 3.11 + coinor-cbc
│   ├── requirements.txt     # Backend Python dependencies
│   ├── scripts/
│   │   └── caching-script.py # Automated cache warming script
│   └── tests/               # Pytest test suite
│       ├── conftest.py       # --e2e flag for accuracy tests
│       ├── test_ingredient_analyzer.py
│       ├── test_chain_reader.py
│       ├── test_engine.py
│       └── test_accuracy_e2e.py
├── mcp_servers/             # MCP tool modules
│   ├── calorie_optimizer.py # PuLP linear programming solver
│   ├── chain_reader.py      # FatSecret + Gemini menu fetch + Supabase cache
│   ├── image_scraper.py     # Gemini Vision menu scanner (FastAPI server)
│   ├── ingredient_analyzer.py # USDA macro calculator + weight parsing
│   ├── judge.py             # Result ranking (gap + cost sort)
│   ├── restaurant_finder.py # Google Places search (up to 15 results)
│   ├── supabase_client.py   # Shared DB connection
│   ├── Dockerfile           # Python 3.11 + coinor-cbc
│   └── requirements.txt     # MCP Python dependencies
├── macrohunter-frontend/    # Expo React Native app
│   ├── Dockerfile           # Node 20 Alpine + Expo
│   ├── package.json         # Frontend npm dependencies
│   ├── app.json             # Expo configuration
│   ├── index.js             # Expo Router entry point
│   └── src/
│       ├── App.js           # Legacy monolithic version (pre-refactor)
│       ├── app/
│       │   ├── _layout.js   # Root layout (SearchProvider + font loading)
│       │   ├── index.js     # Home screen (macro inputs + search/scan)
│       │   ├── results.js   # Results screen (cards + lightbox + filters)
│       │   ├── scan.js      # Scanning screen (animated scan overlay)
│       │   └── auth/
│       │       └── login.js # Auth placeholder (future feature)
│       ├── constants/
│       │   ├── colors.js    # Color palette (dark theme)
│       │   ├── component-style.js # className-to-style wrapper components
│       │   └── styles.js    # StyleSheet definitions
│       └── context/
│           └── SearchContext.js # Global results + scan payload state
├── docs/                    # Documentation
│   ├── architecture.md      # System design & component breakdown
│   ├── workflows.md         # Detailed workflow diagrams
│   ├── api-reference.md     # Endpoint schemas
│   └── setup.md             # Setup & development guide
├── .github/workflows/
│   └── daily-caching.yml    # Bi-weekly automated cache warming
├── benchmark.py             # End-to-end pipeline timing + accuracy benchmark
├── accuracy_ground_truth.py # Ground truth macro data for accuracy testing
├── benchmark_history.txt    # Timestamped benchmark run history
└── docker-compose.yml       # 3-service container config
```

---

## Frontend Features

| Feature | Description |
|---|---|
| **Macro Input Forms** | CaloriesCard with visual progress bar (0–3000 scale), MacrosCard with color-coded macro proportion bars |
| **GPS Location** | Auto-detects location with permission handling and status display (idle → acquiring → ready / denied) |
| **Camera Integration** | Captures menu photos via `expo-image-picker` with base64 encoding |
| **SSE Streaming** | Real-time backend progress updates via EventSource (`react-native-sse`) |
| **Animated Loading** | Radar pulse, spinning arc, bouncing dots, fading headline, and streaming progress bar during search |
| **Animated Scan Screen** | Scan-line sweep, glowing border, corner accents over captured menu image with progress bar |
| **Result Cards** | Score percentage, macro breakdown, cost, estimated vs. verified badge, star ratings |
| **Swipeable Lightbox** | PanResponder-driven vertical swipe to navigate between result details with spring animations |
| **Filter & Sort Panel** | Filter by max price ($10/$20/$30), verified-only toggle, sort by best match/protein/carbs/fats |
| **Native Maps Directions** | Opens Apple Maps / Google Maps with restaurant coordinates |
| **Top Pick Badge** | Highlights the best-matching optimal result (only when sorted by best match) |
| **Star Ratings** | Fractional star display for Google ratings (supports partial fills like 4.3★) |
| **Typography** | Inter (Regular/Medium/SemiBold/Bold) + Montserrat (Bold/ExtraBold) via `@expo-google-fonts` |
| **Dark Theme** | Full dark UI with accent green (`#39ff7e`), dark backgrounds, and muted borders |

---

## Documentation

| Document                               | Description                                                                  |
| -------------------------------------- | ---------------------------------------------------------------------------- |
| [Architecture](docs/architecture.md)   | System design, component breakdown, state schema, external APIs              |
| [Workflows](docs/workflows.md)         | Search & Vision path diagrams, caching, ingredient analysis, LP math, scoring |
| [API Reference](docs/api-reference.md) | Endpoint specs, SSE event schemas, request/response formats                  |
| [Setup Guide](docs/setup.md)           | Environment setup, Docker & local development, testing & benchmarks          |

---

## Running Tests & Benchmarks

### Unit Tests
```bash
cd backend
python -m pytest tests/ -v
```

### End-to-End Accuracy Tests
```bash
# Runs tests that hit real APIs (USDA, FatSecret, Gemini)
cd backend
python -m pytest tests/ -v --e2e
```

### Pipeline Benchmark
```bash
# Run a full 3-iteration end-to-end benchmark (default: search path, NYC location)
python benchmark.py

# Custom runs and location
python benchmark.py --runs 5 --lat 40.71 --lon -74.00

# Run ONLY the accuracy test (bypasses the graph to quickly test AI estimation accuracy)
python benchmark.py --runs 0 --accuracy

# Vision mode benchmark
python benchmark.py --mode vision --image path/to/menu.jpg

# Custom macro targets
python benchmark.py --calories 800 --protein 50 --carbs 60 --fats 30
```

Benchmark results are automatically prepended to `benchmark_history.txt` with timestamps.

---

## License

This project is for educational and personal use.
