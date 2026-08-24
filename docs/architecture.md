# System Architecture

## High-Level Overview

MacroHunter is a three-tier application built around an **AI-orchestrated agentic workflow**. The system uses a LangGraph state machine to coordinate multiple MCP (Model Context Protocol) servers, each responsible for a discrete task in the meal-optimization pipeline.

```
┌─────────────────────────────────────────────────────────────────┐
│  Frontend (Expo / React Native Web)                             │
│  Port 8081                                                      │
│  - Macro input forms          - Result cards + lightbox         │
│  - Camera upload              - GPS location                    │
│  - SSE progress streaming     - Animated loading screens        │
│  - Native maps directions     - Swipeable result detail         │
└────────────────────┬────────────────────────────────────────────┘
                     │  SSE (Server-Sent Events)
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│  Backend Engine (FastAPI + LangGraph)                            │
│  Port 8000                                                      │
│  - POST /api/optimize-meal              (search path, SSE)      │
│  - POST /api/optimize-menu-image-stream (vision path, SSE)      │
│  - POST /api/optimize-menu-image        (vision path, SSE legacy)│
│  - Invokes LangGraph state machine (graph.py)                   │
│  - Streams node-by-node progress via agent_update events        │
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
| `react-native-sse` | EventSource polyfill for SSE streaming |
| `react-native-web` | Web export for browser testing |
| `react-native-svg` | SVG rendering for lightbox close button |

The frontend is a **multi-screen Expo Router app** with these key files:

- **`_layout.js`** — root layout wrapping all pages in `SearchProvider`
- **`index.js`** — home screen with **HunterPage**, **CaloriesCard**, **MacrosCard**, **LocationCard**, camera scan button, SSE search streaming, and animated loading screen (radar pulse + spinning arc + bouncing dots)
- **`results.js`** — results screen with **ResultTextel** (result list), **ResultCard** (score percentage, macro breakdown, cost, verified/estimated badge), **ResultLightbox** (swipeable detail view with PanResponder, restaurant photo, native maps directions, match score chip)
- **`scan.js`** — scanning screen showing the captured menu image with animated scan-line sweep, glowing border, corner accent marks, and SSE progress text from the backend

#### Key Frontend Components

| Component | File | Description |
|---|---|---|
| `CaloriesCard` | `index.js` | Calorie input with visual progress bar (0–3000 scale) |
| `MacrosCard` | `index.js` | Protein/carbs/fats inputs with color-coded proportion bars |
| `LocationCard` | `index.js` | GPS status display (idle → acquiring → ready / denied) |
| `BasicLoadingScreen` | `index.js` | Animated radar pulse, spinning arc, bouncing dots, fading headline |
| `ResultCard` | `results.js` | Summary card: dish name, restaurant, macros, cost, score tag |
| `ResultLightbox` | `results.js` | Full detail modal: photo, macros, price, directions button, swipe navigation |
| `Scan` | `scan.js` | Menu image with scan-line animation and SSE progress updates |
| `SearchProvider` | `SearchContext.js` | Global state for results and scan payload across screens |

#### Debug Panel

In development mode (`__DEV__`), a toolbar appears at the bottom of the home screen with shortcuts to:
- **→ Results** — inject mock data and navigate to the results screen
- **→ Scan** — open the scan screen with a placeholder image
- **→ Load** — trigger the loading screen animation (auto-dismisses after 5s)

### Backend Engine — `backend/`

| File | Role |
|---|---|
| `engine.py` | FastAPI app with three endpoints, CORS middleware, SSE streaming helpers, and node-to-UI message translations |
| `graph.py` | LangGraph `StateGraph` defining the agentic workflow with conditional routing and parallel fan-out |

The engine is the **orchestration layer**. It accepts user requests, builds an initial `State` dict, invokes the compiled LangGraph via `astream()`, translates each node's output into user-facing progress messages, and streams them as SSE events. The final `done` event includes the `final_orders` array.

#### SSE Streaming Architecture

Both `stream_helper()` and `image_stream_helper()` follow the same pattern:

1. Yield an immediate `agent_update` event so the UI updates instantly
2. Iterate over `graph.astream(state, stream_mode="updates")`
3. Translate each node's output via `NODE_TRANSLATIONS` dict
4. Yield `agent_update` events with `headline` and `detail` text
5. Yield a final `done` event with the `results` array
6. On exception, yield an `error` event

### MCP Tool Servers — `mcp_servers/`

Each server is a standalone Python module decorated with `@mcp.tool()` using the Anthropic MCP SDK (`FastMCP`). The backend imports these functions directly (no HTTP between them) except for the image scraper.

| Server | File | External APIs |
|---|---|---|
| Restaurant Finder | `restaurant_finder.py` | Google Places Nearby Search |
| Chain Reader | `chain_reader.py` | FatSecret (OAuth 2.0), Gemini 2.5 Flash, Supabase `menu_cache` |
| Calorie Optimizer | `calorie_optimizer.py` | PuLP (CBC solver, local) |
| Ingredient Analyzer | `ingredient_analyzer.py` | USDA FoodData Central (with `_RetryClient` in-memory memoization) |
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

The `expo-app` service uses environment variables for network configuration:
- `REACT_NATIVE_PACKAGER_HOSTNAME` — set to `HOST_IP` for physical device testing
- `EXPO_PUBLIC_HOST_IP` — backend URL used by the frontend's SSE connections
- `CHOKIDAR_USEPOLLING` / `WATCHPACK_POLLING` — enables file-change detection inside Docker for hot reload

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
