# System Architecture

## High-Level Overview

MacroHunter is a three-tier application built around an **AI-orchestrated agentic workflow**. The system uses a LangGraph state machine to coordinate multiple MCP (Model Context Protocol) tool servers, each responsible for a discrete task in the meal-optimization pipeline.

```
┌─────────────────────────────────────────────────────────────────┐
│  Frontend (Expo / React Native Web)                             │
│  Port 8081                                                      │
│  - Macro input forms          - Result cards + lightbox         │
│  - Camera upload              - GPS location                    │
│  - SSE progress streaming     - Animated loading screens        │
│  - Native maps directions     - Swipeable result detail         │
│  - Filter & sort panel        - Star ratings                    │
│  - Dark theme (accent green)  - Inter + Montserrat fonts        │
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
| React Native 0.81 + Expo SDK 54 | Cross-platform UI (iOS, Android, Web) |
| `expo-location` | Device GPS coordinates |
| `expo-image-picker` | Camera / gallery access for menu photos |
| `react-native-sse` | EventSource polyfill for SSE streaming |
| `react-native-web` | Web export for browser testing |
| `react-native-svg` | SVG rendering for lightbox close button and filter icon |
| `@expo-google-fonts/inter` | Inter font (Regular, Medium, SemiBold, Bold) |
| `@expo-google-fonts/montserrat` | Montserrat font (Bold, ExtraBold) for logo |

The frontend is a **multi-screen Expo Router app** with these key files:

- **`_layout.js`** — root layout wrapping all pages in `SearchProvider`, loads 6 font variants (Inter 400/500/600/700, Montserrat 700/800), renders the `MacroHunter` logo header with an info button
- **`index.js`** — home screen with **HunterPage**, **CaloriesCard**, **MacrosCard**, camera scan button, SSE search streaming, and animated loading screen (radar pulse + spinning arc + bouncing dots + streaming progress bar)
- **`results.js`** — results screen with **ResultTextel** (result list with back/filter buttons), **ResultCard** (score percentage, macro breakdown, cost, verified/estimated badge, star ratings), **ResultLightbox** (swipeable detail view with PanResponder, restaurant photo, native maps directions, match score chip), and **FilterLightbox** (sort by match/protein/carbs/fats, max price filter, verified-only toggle)
- **`scan.js`** — scanning screen showing the captured menu image with animated scan-line sweep, glowing border, corner accent marks, streaming progress bar, and SSE progress text from the backend
- **`auth/login.js`** — placeholder login screen for future authentication feature

#### Key Frontend Components

| Component | File | Description |
|---|---|---|
| `CaloriesCard` | `index.js` | Calorie input with visual progress bar (0–3000 scale) |
| `MacrosCard` | `index.js` | Protein/carbs/fats inputs with color-coded proportion bars |
| `MacroBar` | `index.js` | Horizontal proportion bar showing a macro's share of the total |
| `BasicLoadingScreen` | `index.js` | Animated radar pulse, spinning arc, bouncing dots, fading headline, and streaming progress bar with deceleration easing |
| `ScoreTag` | `index.js`, `results.js` | Color-coded match percentage badge (green ≥90%, yellow ≥75%, red <75%) |
| `SkeletonCard` | `index.js`, `results.js` | Loading placeholder card with animated shimmer lines |
| `ResultCard` | `results.js` | Summary card: dish name, restaurant, macros, cost, score tag, star rating, estimated/verified badge |
| `StarRating` | `results.js` | Fractional star display for Google ratings (supports partial fills) |
| `ResultLightbox` | `results.js` | Full detail modal: photo, macros, price, directions button, swipe navigation via PanResponder |
| `FilterLightbox` | `results.js` | Sort options (match/protein/carbs/fats), max price ($10/$20/$30/any), verified-only toggle |
| `ResultTextel` | `results.js` | Result list container with header, back button, filter button, and empty states |
| `Scan` | `scan.js` | Menu image with scan-line animation, streaming progress bar, bouncing dots, and SSE progress updates |
| `SearchProvider` | `SearchContext.js` | Global state for `results` and `scanPayload` across screens |
| `AppLayout` | `index.js` | Radar background, logo, GPS status display (unused in current flow) |

#### Component Style System

The frontend uses a **className-to-StyleSheet mapping** system (`component-style.js`) that wraps React Native's built-in components (`View`, `Text`, `TextInput`, `TouchableOpacity`, `Image`, `SafeAreaView`). Each wrapper accepts a `className` prop containing space-separated style names, which are resolved against the master `styles.js` StyleSheet. This provides a CSS-like authoring experience while using native React Native StyleSheets under the hood.

#### Color Palette

Defined in `constants/colors.js`, the app uses a dark-mode-first palette:

| Token | Value | Usage |
|---|---|---|
| `bg` | `#090d0b` | App background |
| `surface` | `#0f1710` | Card/panel surfaces |
| `surface2` | `#152018` | Elevated surfaces |
| `border` | `#1e3326` | Borders and separators |
| `accent` | `#39ff7e` | Primary accent (green) |
| `accentDim` | `rgba(57,255,126,0.12)` | Subtle accent overlays |
| `accentGlow` | `rgba(57,255,126,0.35)` | Glow effects |
| `protein` | `#ff6b35` | Protein color (orange) |
| `carbs` | `#ffd23f` | Carbs color (yellow) |
| `fats` | `#4ecdc4` | Fats color (teal) |
| `text` | `#e8f5ee` | Primary text |
| `muted` | `#5a7a65` | Secondary text |
| `danger` | `#ff4545` | Error/danger states |

### Backend Engine — `backend/`

| File | Role |
|---|---|
| `engine.py` | FastAPI app with three endpoints, CORS middleware, SSE streaming helpers, and node-to-UI message translations |
| `graph.py` | LangGraph `StateGraph` defining the agentic workflow with conditional routing, parallel fan-out via `Send()`, and `timed_node` decorator for performance logging |

The engine is the **orchestration layer**. It accepts user requests, builds an initial `State` dict, invokes the compiled LangGraph via `astream()`, translates each node's output into user-facing progress messages, and streams them as SSE events. The final `done` event includes the `final_orders` array.

#### SSE Streaming Architecture

Both `stream_helper()` and `image_stream_helper()` follow the same pattern:

1. Yield an immediate `agent_update` event so the UI updates instantly
2. Iterate over `graph.astream(state, stream_mode="updates")`
3. Log per-node timing via `time.perf_counter()` split/total timestamps
4. Translate each node's output via `NODE_TRANSLATIONS` dict
5. Yield `agent_update` events with `headline` and `detail` text
6. Capture `final_orders` when the judge node completes
7. Yield a final `done` event with the `results` array
8. On exception, yield an `error` event

#### Graph Node Timing

The `timed_node` decorator in `graph.py` wraps every graph node and logs wall-clock execution time to stdout. For parallel `fetch_and_optimize` branches, the decorator includes the restaurant name in the log label so branches are distinguishable.

### MCP Tool Servers — `mcp_servers/`

Each server is a standalone Python module decorated with `@mcp.tool()` using the Anthropic MCP SDK (`FastMCP` from `mcp[cli]>=1.0,<2.0`). The backend imports these functions directly (no HTTP between them) except for the image scraper, which runs as an independent FastAPI service.

| Server | File | External APIs |
|---|---|---|
| Restaurant Finder | `restaurant_finder.py` | Google Places Nearby Search (up to 15 results, paginated) |
| Chain Reader | `chain_reader.py` | FatSecret (OAuth 2.0), Gemini 2.5 Flash (structured output), Supabase `menu_cache` |
| Calorie Optimizer | `calorie_optimizer.py` | PuLP (CBC solver, local) |
| Ingredient Analyzer | `ingredient_analyzer.py` | USDA FoodData Central (with `_RetryClient` in-memory memoization, 6 retries with backoff) |
| Image Scraper | `image_scraper.py` | Gemini 2.5 Flash (vision, structured output) |
| Judge | `judge.py` | None (pure sorting by macro gap + cost) |
| Supabase Client | `supabase_client.py` | Supabase Postgres |

#### Key Implementation Details

- **Chain Reader dual path**: Known chains (39 entries in `KNOWN_CHAINS` list) use FatSecret API for verified nutrition data. Unknown restaurants use Gemini AI to estimate ingredients, which are then analyzed via USDA FoodData Central for real macros. Both paths use Gemini for price estimation.
- **FatSecret serving normalization**: The chain reader handles partial servings (per slice, per 100g, per oz) by fetching the full serving list via `food.get.v2` and either finding a whole-item serving or multiplying fractional servings by their denominator (e.g., 1/8 pizza × 8 = whole pizza).
- **Menu normalization**: `_normalize_menu()` normalizes all different field naming conventions (cal/calories/Cal, protein/Protein/p/P, etc.) into a consistent shape before passing to the optimizer.
- **Ingredient Analyzer**: Uses context-aware weight tables (`SLICE_WEIGHTS`, `PIECE_WEIGHTS`, `CUP_WEIGHTS`, `NO_UNIT_WEIGHTS`) and hardcoded `COMMON_FALLBACKS` for ingredients that USDA search consistently fails on. Includes precision-recall scoring (`_score_usda_match`) and core noun extraction (`_core_noun`) for accurate USDA result matching.
- **Concurrency in Ingredient Analyzer**: `run_analyze_ingredient()` uses `asyncio.gather()` with a `Semaphore(2)` to rate-limit USDA API calls, and handles the case of being called from within a running event loop (LangGraph's `astream`) by spawning a separate thread.

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

> **Note:** The backend Dockerfile's default CMD references `main:app`, but `docker-compose.yml` overrides this to `engine:app`. Always launch via `docker compose up`.

---

## State Schema

The LangGraph state is defined as a `TypedDict`:

```python
class State(TypedDict):
    restaurant_list: list[str] | None
    current_restaurant_index: int | None  # used by Send() for parallel branches
    menu_items: list[str] | None          # only used by the vision path
    searching_for_restaurant: bool
    lat: float | None
    lon: float | None
    best_orders: Annotated[list[str], add]   # reducer for parallel writes
    target_calories: float
    target_protein: float
    target_carbs: float
    target_fats: float
    final_orders: list[str] | None
    image_b64: str | None                    # base64 image for vision path
```

The `best_orders` field uses LangGraph's **`add` reducer** — this allows parallel branches to safely append results without write conflicts. Each `fetch_and_optimize` branch writes only to `best_orders`, and the reducer concatenates all branch outputs before the `judge` node runs.

The `menu_items` and `current_restaurant_index` fields are **not written to shared state** in the parallel search path — each branch keeps them as local variables inside `fetch_and_optimize` to avoid `InvalidUpdateError` from multiple branches writing to the same non-reducer key.

---

## External API Dependencies

| API | Auth Method | Purpose |
|---|---|---|
| Google Places | API Key | Find nearby restaurants (up to 15, paginated with `next_page_token`) |
| FatSecret | OAuth 2.0 Client Credentials | Chain restaurant nutrition data (search + food detail endpoints) |
| Gemini 2.5 Flash | API Key | Menu estimation (structured output), price estimation, image-to-menu vision |
| USDA FoodData Central | API Key | Per-ingredient macro lookup (with retry + in-memory cache) |
| Supabase | API Key | Menu cache persistence (upsert with 7-day TTL) |

---

## Benchmarking & Accuracy Testing

MacroHunter includes a comprehensive benchmarking system:

- **`benchmark.py`** — fires the LangGraph pipeline directly in-process N times, collecting per-node timings with mean/min/max/stdev. Supports both search and vision modes with configurable locations and macro targets.
- **`accuracy_ground_truth.py`** — ground truth macro data from official restaurant nutrition pages (McDonald's, Chick-fil-A) for both the FatSecret path and AI estimation path.
- **`benchmark_history.txt`** — auto-appended timestamped history of all benchmark runs.

The accuracy test uses fuzzy item name matching and reports Mean Absolute Percentage Error (MAPE) per macro across all tested restaurants.
