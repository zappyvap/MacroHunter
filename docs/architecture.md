# System Architecture

## High-Level Overview

MacroHunter is a three-tier application built around an **AI-orchestrated agentic workflow**. The system uses a LangGraph state machine to coordinate multiple MCP (Model Context Protocol) servers, each responsible for a discrete task in the meal-optimization pipeline.

```
┌─────────────────────────────────────────────────────────────────┐
│  Frontend (Expo / React Native Web)                             │
│  Port 8081                                                      │
│  - Macro input forms          - Result cards + lightbox         │
│  - Camera upload              - GPS location                    │
│  - Google Maps directions                                       │
└────────────────────┬────────────────────────────────────────────┘
                     │  HTTP (JSON / multipart)
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│  Backend Engine (FastAPI + LangGraph)                            │
│  Port 8000                                                      │
│  - POST /api/optimize-meal        (search path)                 │
│  - POST /api/optimize-menu-image  (vision path)                 │
│  - Invokes LangGraph state machine (graph.py)                   │
└────────┬────────────┬───────────────────────────────────────────┘
         │            │
         ▼            ▼
┌────────────┐  ┌──────────────────────────────────────────────────┐
│  Scanner   │  │  MCP Tool Servers (imported directly)            │
│  (FastAPI) │  │  - restaurant_finder  → Google Places API        │
│  Port 8001 │  │  - chain_reader       → FatSecret + Gemini       │
│  image     │  │  - calorie_optimizer  → PuLP linear programming  │
│  scraper   │  │  - ingredient_analyzer→ USDA FDC API             │
│            │  │  - judge              → ranking logic             │
└────────────┘  └──────────────────────────────────────────────────┘
                            │
                            ▼
                ┌───────────────────────┐
                │  Supabase (Postgres)  │
                │  - menu_cache table   │
                └───────────────────────┘
```

---

## Component Breakdown

### Frontend — `macrohunter-frontend/`

| Technology | Purpose |
|---|---|
| React Native + Expo SDK 54 | Cross-platform UI (iOS, Android, Web) |
| `expo-location` | Device GPS coordinates |
| `expo-image-picker` | Camera / gallery access for menu photos |
| `react-native-web` | Web export for browser testing |

The frontend is a **multi-screen Expo Router app** with these key files:

- **`_layout.js`** — root layout wrapping all pages in `SearchProvider`
- **`index.js`** — home screen with **HunterPage**, **CaloriesCard**, **MacrosCard**, **LocationCard**, and camera scan button
- **`results.js`** — results screen with **ResultTextel** (result list), **ResultCard**, and **ResultLightbox** (detail view with directions)
- **`scan.js`** — scanning screen showing the captured menu image with a loading spinner

### Backend Engine — `backend/`

| File | Role |
|---|---|
| `engine.py` | FastAPI app with two endpoints and CORS middleware |
| `graph.py` | LangGraph `StateGraph` defining the agentic workflow |

The engine is the **orchestration layer**. It accepts user requests, builds an initial `State` dict, invokes the compiled LangGraph, and returns the `final_orders` to the frontend.

### MCP Tool Servers — `mcp_servers/`

Each server is a standalone Python module decorated with `@mcp.tool()` using the Anthropic MCP SDK (`FastMCP`). The backend imports these functions directly (no HTTP between them) except for the image scraper.

| Server | File | External APIs |
|---|---|---|
| Restaurant Finder | `restaurant_finder.py` | Google Places Nearby Search |
| Chain Reader | `chain_reader.py` | FatSecret (OAuth 2.0), Gemini 2.5 Flash |
| Calorie Optimizer | `calorie_optimizer.py` | PuLP (CBC solver, local) |
| Ingredient Analyzer | `ingredient_analyzer.py` | USDA FoodData Central |
| Image Scraper | `image_scraper.py` | Gemini 2.5 Flash (vision) |
| Judge | `judge.py` | None (pure sorting) |
| Supabase Client | `supabase_client.py` | Supabase Postgres |

### Containerization — `docker-compose.yml`

Three Docker services:

| Service | Build Context | Port | Command |
|---|---|---|---|
| `engine` | `./backend` | 8000 | `uvicorn engine:app` |
| `scanner` | `./mcp_servers` | 8001 | `uvicorn image_scraper:app` |
| `expo-app` | `./macrohunter-frontend` | 8081 | Expo dev server |

The `engine` service mounts `./mcp_servers` at `/app/mcp_servers` so the backend can import the tools directly.

---

## State Schema

The LangGraph state is defined as a `TypedDict`:

```python
class State(TypedDict):
    restaurant_list: list[str] | None
    current_restaurant_index: int | None
    menu_items: list[str] | None
    searching_for_restaurant: bool
    lat: float | None
    lon: float | None
    best_orders: Annotated[list[str], add]   # reducer for parallel writes
    target_calories: float
    target_protein: float
    target_carbs: float
    target_fats: float
    final_orders: list[str] | None
    image_b64: str | None
```

The `best_orders` field uses LangGraph's **`add` reducer** — this allows parallel branches to safely append results without write conflicts.

---

## External API Dependencies

| API | Auth Method | Purpose |
|---|---|---|
| Google Places | API Key | Find nearby restaurants |
| FatSecret | OAuth 2.0 Client Credentials | Chain restaurant nutrition data |
| Gemini 2.5 Flash | API Key | Menu estimation, price estimation, image-to-menu |
| USDA FoodData Central | API Key | Per-ingredient macro lookup |
| Supabase | API Key | Menu cache persistence |
