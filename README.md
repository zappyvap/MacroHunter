# 🎯 MacroHunter

**AI-Powered Meal Optimization — Find the best meal for your macros at nearby restaurants.**

MacroHunter is a decision support system that solves daily nutrition mathematically. Unlike food trackers (MyFitnessPal), it actively calculates the optimal meal to order based on your remaining macro targets, budget, and location using linear programming and AI.

---

## How It Works

1. **Set your macro targets** — calories, protein, carbs, and fats
2. **Choose your input method:**
   - 📍 **Search nearby** — GPS finds restaurants around you
   - 📸 **Scan a menu** — Take a photo of a physical menu
3. **Get optimized orders** — PuLP linear programming finds the cheapest combination of items that hits your macros
4. **Compare results** — Orders are ranked by macro accuracy and cost across multiple restaurants

---

## Tech Stack

| Layer              | Technology                                     |
| ------------------ | ---------------------------------------------- |
| **Frontend**       | React Native + Expo SDK 54 (iOS, Android, Web) |
| **Backend**        | FastAPI + LangGraph (agentic state machine)    |
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
- Ranks all results by macro accuracy and cost

### Vision Path (Menu Scan)

```
START → image_translation → optimize_calories → judge → END
```

- Sends menu photo to Gemini Vision for item + ingredient extraction
- Calculates macros via USDA FoodData Central
- Runs the PuLP solver up to 3 times to generate diverse order options

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

| Method | Endpoint                   | Description                            |
| ------ | -------------------------- | -------------------------------------- |
| `POST` | `/api/optimize-meal`       | Search nearby restaurants and optimize |
| `POST` | `/api/optimize-menu-image` | Upload menu photo and optimize         |

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

---

## Project Structure

```
MacroHunter/
├── backend/                 # FastAPI + LangGraph orchestration
│   ├── engine.py            # API endpoints
│   ├── graph.py             # Agentic state machine
│   └── tests/               # Pytest test suite
├── mcp_servers/             # MCP tool modules
│   ├── calorie_optimizer.py # PuLP linear programming solver
│   ├── chain_reader.py      # FatSecret + Gemini menu fetch
│   ├── image_scraper.py     # Gemini Vision menu scanner
│   ├── ingredient_analyzer.py # USDA macro calculator
│   ├── judge.py             # Result ranking
│   ├── restaurant_finder.py # Google Places search
│   └── supabase_client.py   # Shared DB connection
├── macrohunter-frontend/    # Expo React Native app
│   └── src/
│       ├── App.js           # Web-only single-screen version (legacy)
│       ├── app/
│       │   ├── _layout.js   # Root layout (SearchProvider)
│       │   ├── index.js     # Home screen (macro inputs + search/scan)
│       │   ├── results.js   # Results screen (cards + lightbox)
│       │   └── scan.js      # Scanning screen (image preview)
│       ├── constants/       # Colors, styles, component wrappers
│       └── context/         # SearchContext (global results state)
├── docs/                    # Documentation
│   ├── architecture.md      # System design & component breakdown
│   ├── workflows.md         # Detailed workflow diagrams
│   ├── api-reference.md     # Endpoint schemas
│   └── setup.md             # Setup & development guide
└── docker-compose.yml       # 3-service container config
```

---

## Documentation

| Document                               | Description                                                          |
| -------------------------------------- | -------------------------------------------------------------------- |
| [Architecture](docs/architecture.md)   | System design, component breakdown, state schema, external APIs      |
| [Workflows](docs/workflows.md)         | Search & Vision path diagrams, caching, ingredient analysis, LP math |
| [API Reference](docs/api-reference.md) | Endpoint specs, request/response schemas                             |
| [Setup Guide](docs/setup.md)           | Environment setup, Docker & local development, running tests         |

---

## Running Tests

```bash
cd backend
python -m pytest tests/ -v
```

---

## License

This project is for educational purposes (Summer 2026 build).
