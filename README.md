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
6. **Get directions** — Tap to open native maps with directions to any restaurant

---

## Tech Stack

| Layer              | Technology                                     |
| ------------------ | ---------------------------------------------- |
| **Frontend**       | React Native + Expo SDK 54 (iOS, Android, Web) |
| **Backend**        | FastAPI + LangGraph (agentic state machine)     |
| **Streaming**      | Server-Sent Events (SSE) for real-time updates  |
| **AI**             | Gemini 2.5 Flash (vision + text)               |
| **Optimization**   | PuLP (CBC linear programming solver)           |
| **Nutrition Data** | FatSecret API, USDA FoodData Central           |
| **Location**       | Google Places Nearby Search                    |
| **Caching**        | Supabase (Postgres)                            |
| **Deployment**     | Docker Compose (3 services)                    |
| **MCP**            | Anthropic Model Context Protocol SDK           |

---

## Architecture

MacroHunter uses a **LangGraph state machine** to orchestrate multiple MCP tool servers. Two workflows share the same graph:

### Search Path (Restaurant Discovery)

```
START → find_restaurants → fan_out (parallel) → fetch_and_optimize × N → judge → END
```

- Finds nearby restaurants via Google Places
- Fetches menus from FatSecret (known chains) or Gemini AI estimation (local restaurants)
- Runs the PuLP solver in parallel for each restaurant
- Streams real-time progress updates to the frontend via SSE
- Ranks all results by macro accuracy and cost

### Vision Path (Menu Scan)

```
START → image_translation → optimize_calories → judge → END
```

- Sends menu photo to Gemini Vision for item + ingredient extraction
- Calculates macros via USDA FoodData Central
- Runs the PuLP solver up to 3 times to generate diverse order options
- Streams scanning progress to a dedicated animated scan screen

---

## Quick Start

### Prerequisites

- Python 3.11+, Node.js 18+, Docker

### 1. Clone and configure

```bash
git clone https://github.com/your-username/MacroHunter.git
cd MacroHunter
cp .env.example .env  # Fill in your API keys
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
uvicorn engine:app --port 8000 --reload

# Scanner (separate terminal)
cd mcp_servers
uvicorn image_scraper:app --port 8001 --reload

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
│   └── tests/               # Pytest test suite
├── mcp_servers/             # MCP tool modules
│   ├── calorie_optimizer.py # PuLP linear programming solver
│   ├── chain_reader.py      # FatSecret + Gemini menu fetch
│   ├── image_scraper.py     # Gemini Vision menu scanner (FastAPI)
│   ├── ingredient_analyzer.py # USDA macro calculator
│   ├── judge.py             # Result ranking
│   ├── restaurant_finder.py # Google Places search
│   └── supabase_client.py   # Shared DB connection
├── macrohunter-frontend/    # Expo React Native app
│   └── src/
│       ├── app/
│       │   ├── _layout.js   # Root layout (SearchProvider)
│       │   ├── index.js     # Home screen (macro inputs + search/scan)
│       │   ├── results.js   # Results screen (cards + swipeable lightbox)
│       │   └── scan.js      # Scanning screen (animated scan overlay)
│       ├── constants/       # Colors, styles, component wrappers
│       └── context/         # SearchContext (global results + scan payload)
├── docs/                    # Documentation
│   ├── architecture.md      # System design & component breakdown
│   ├── workflows.md         # Detailed workflow diagrams
│   ├── api-reference.md     # Endpoint schemas
│   └── setup.md             # Setup & development guide
└── docker-compose.yml       # 3-service container config
```

---

## Frontend Features

| Feature | Description |
|---|---|
| **Macro Input Forms** | CaloriesCard with visual progress bar, MacrosCard with color-coded macro bars |
| **GPS Location** | Auto-detects location with permission handling and status display |
| **Camera Integration** | Captures menu photos via `expo-image-picker` with base64 encoding |
| **SSE Streaming** | Real-time backend progress updates via EventSource (react-native-sse) |
| **Animated Loading** | Radar pulse, spinning arc, bouncing dots, and fading text during search |
| **Animated Scan Screen** | Scan-line sweep, glowing border, corner accents over captured menu image |
| **Result Cards** | Score percentage, macro breakdown, cost, estimated vs. verified badge |
| **Swipeable Lightbox** | PanResponder-driven vertical swipe to navigate between result details |
| **Native Maps Directions** | Opens Apple Maps / Google Maps with restaurant coordinates |
| **Top Pick Badge** | Highlights the best-matching optimal result |
| **Debug Panel** | Dev-only toolbar with shortcuts to mock results, scan, and loading screens |

---

## Documentation

| Document                               | Description                                                                  |
| -------------------------------------- | ---------------------------------------------------------------------------- |
| [Architecture](docs/architecture.md)   | System design, component breakdown, state schema, external APIs              |
| [Workflows](docs/workflows.md)         | Search & Vision path diagrams, caching, ingredient analysis, LP math         |
| [API Reference](docs/api-reference.md) | Endpoint specs, SSE event schemas, request/response formats                  |
| [Setup Guide](docs/setup.md)           | Environment setup, Docker & local development, running tests                 |

---

## Running Tests & Benchmarks

To run the standard pytest suite:
```bash
cd backend
python -m pytest tests/ -v
```

To run the end-to-end performance and accuracy benchmark (tests the LangGraph pipeline against known ground-truth macros):
```bash
# Run a full 3-iteration end-to-end benchmark
python benchmark.py

# Run ONLY the accuracy test (bypasses the graph to quickly test AI estimation accuracy)
python benchmark.py --runs 0 --accuracy
```

---

## License

This project is for educational purposes (Summer 2026 build).
