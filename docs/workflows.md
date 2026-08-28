# Core Workflows

MacroHunter has **two primary workflows** that share the same LangGraph state machine but take different paths through it. Both end at the **Judge** node, which ranks all candidate meals and returns the best options.

---

## Workflow 1 — Search Path (Restaurant Discovery)

**Trigger:** User enters macro targets → taps "Hunt Meals Nearby" → browser grants GPS.

```
┌─────────┐     ┌───────────────────┐     ┌─────────────────────┐
│  START  │────▶│ find_restaurants  │────▶│ fan_out_restaurants  │
└─────────┘     └───────────────────┘     └──────────┬──────────┘
                                                     │
                          ┌──────────────────────────┼──────────────────────────┐
                          ▼                          ▼                          ▼
                ┌─────────────────┐        ┌─────────────────┐       ┌─────────────────┐
                │fetch_and_optimize│       │fetch_and_optimize│      │fetch_and_optimize│
                │  (restaurant 0) │       │  (restaurant 1) │      │  (restaurant 2) │
                └────────┬────────┘       └────────┬────────┘      └────────┬────────┘
                         │                         │                        │
                         └─────────────────────────┼────────────────────────┘
                                                   ▼
                                            ┌────────────┐     ┌───────┐
                                            │   judge    │────▶│  END  │
                                            └────────────┘     └───────┘
```

### Step-by-step

1. **Route Decision** (`route_user_input`)
   - `state.searching_for_restaurant == True` → enter Search Path.

2. **Find Restaurants** (`find_restaurants`)
   - Calls `restaurant_finder()` with user lat/lon and a 5-mile radius.
   - Uses Google Places Nearby Search API.
   - Returns up to 3 restaurants (configurable via `RESULT_LIMIT`).
   - Writes `restaurant_list` to state.

3. **Fan-Out** (`fan_out_restaurants`)
   - Uses LangGraph `Send()` to spawn one parallel `fetch_and_optimize` branch per restaurant.
   - Each branch receives its own `current_restaurant_index`.

4. **Fetch & Optimize** (`fetch_and_optimize`) — *runs in parallel*
   - **Menu Retrieval** — calls `chain_reader(restaurant_name)`:
     - Checks Supabase cache first (see [Caching Workflow](#caching-workflow)).
     - For known chains → FatSecret API (OAuth 2.0 token exchange, search, macro parsing).
     - For unknown restaurants → Gemini AI estimation (ingredient generation + USDA lookup).
     - Price estimation via Gemini for both paths.
   - **Calorie Optimization** — calls `calorie_optimizer(menu, targets)`:
     - Builds a PuLP linear program: minimize cost + macro gap penalties.
     - Decision variables: integer quantity of each menu item.
     - Constraints: hit protein/carbs/fats targets, stay under calorie ceiling.
     - Returns optimal order, achieved macros, gaps, cost, and status.
   - Each branch writes its result to `best_orders` (uses `add` reducer for safe parallel writes).

5. **Judge** (`judge_node`)
   - Receives all `best_orders` from every parallel branch.
   - Sorts by: (1) total macro gap ascending, (2) total cost ascending as tiebreaker.
   - Writes `final_orders` to state.

6. **Response**
   - `engine.py` streams real-time progress via SSE `agent_update` events as each graph node completes.
   - When the judge finishes, a final `done` event is sent containing the `final_orders` array.
   - The frontend's `EventSource` listener receives these events and navigates to the results screen.

---

## Workflow 2 — Vision Path (Menu Scan)

**Trigger:** User uploads a photo of a physical menu via the camera/gallery.

```
┌─────────┐     ┌────────────────────┐     ┌────────────┐     ┌────────────┐     ┌───────┐
│  START  │────▶│ image_translation  │────▶│  optimizer  │────▶│   judge    │────▶│  END  │
└─────────┘     └────────────────────┘     └────────────┘     └────────────┘     └───────┘
```

### Step-by-step

1. **Route Decision** (`route_user_input`)
   - `state.searching_for_restaurant == False` → enter Vision Path.

2. **Image Translation** (`image_translation`)
   - Decodes base64 image from `state.image_b64`.
   - Sends image to the **Scanner** service (`POST http://scanner:8001/translate-menu`).
   - The Scanner uses Gemini 2.5 Flash Vision to:
     - Extract menu items and their ingredients from the image.
     - Use USDA-style naming for ingredients.
     - Estimate large restaurant portion sizes.
     - Extract prices visible on the menu.
   - The ingredient analyzer then calculates macros from USDA data.
   - Writes `menu_items` to state.

3. **Optimize Calories** (`optimize_calories`)
   - Runs the PuLP solver up to **3 times** to generate multiple order options.
   - After each run, removes used items from the pool to force diverse alternatives.
   - Each result is tagged as "Uploaded Menu (Option N)".
   - Writes all options to `best_orders`.

4. **Judge** (`judge_node`)
   - Same ranking logic as the Search Path.

5. **Response**
   - `engine.py` streams progress via SSE `agent_update` events to the scan screen.
   - The scan screen displays each update as animated step text.
   - A final `done` event sends the results, and the frontend navigates to the results screen.

---

## Caching Workflow

The `chain_reader` uses a **Supabase-backed menu cache** to avoid redundant API calls:

```
search_chain_restaurant(name)
        │
        ▼
   ┌──────────────────┐     HIT (fresh)
   │  Check Supabase  │──────────────────▶ Return cached menu
   │  menu_cache      │
   └────────┬─────────┘
            │ MISS or STALE
            ▼
   ┌──────────────────┐
   │  Is it a known   │── YES ──▶ FatSecret API + Gemini price estimation
   │  chain?          │
   └────────┬─────────┘
            │ NO
            ▼
   Gemini AI full menu estimation
   + USDA ingredient analysis
   + Gemini price estimation
            │
            ▼
   Save to Supabase cache
   Return menu
```

- **Cache key:** lowercase, trimmed restaurant name.
- **Staleness:** controlled by `CACHE_MAX_AGE_DAYS` (currently set to 7, meaning menus are cached for a week).
- **Upsert:** uses Supabase `upsert` to insert or update.
- **Failure tolerance:** cache read/write errors are caught and logged but never crash the pipeline.

### Automated Cache Warming

To ensure fast response times for popular locations, a GitHub Action (`.github/workflows/daily-caching.yml`) runs automatically on the 1st and 15th of every month. It executes `backend/scripts/caching-script.py`, which:
1. Simulates a location search using the Google Places API for a predefined central location.
2. Loops through the discovered restaurants and executes `search_chain_restaurant()`.
3. Pre-populates or refreshes the Supabase `menu_cache` before users actually search for those restaurants.

---

## Ingredient Analysis Pipeline

The `ingredient_analyzer` is the most complex data-processing module. When given a list of food items with ingredients, it:

```
Input: [{"item": "Cheeseburger", "ingredients": ["6 oz ground beef", "1 slice cheddar", ...]}]
                │
                ▼
        ┌───────────────────────┐
        │  parse_ingredient_    │  "6 oz ground beef" → ("ground beef", 170.1g)
        │  weight()             │  Uses regex + context-aware weight tables
        └───────────┬───────────┘
                    ▼
        ┌───────────────────────┐
        │  Check hardcoded      │  Eggs, rice, tortillas, sauces
        │  fallback table       │  (USDA search consistently fails on these).
        │  (COMMON_FALLBACKS)   │  Also includes specific fast-food combos like
        │                       │  "steamed bun" or "breaded chicken" which
        │                       │  otherwise fuzzy match to incorrect USDA items.
        └───────────┬───────────┘
                    │ No match
                    ▼
        ┌───────────────────────┐
        │  USDA FDC API search  │  page_size=3
        │  + best_match scoring │  Precision-recall F1 + core noun check
        └───────────┬───────────┘
                    ▼
        ┌───────────────────────┐
        │  USDA portion weight  │  Cross-reference USDA's own portion data
        │  override (optional)  │  with sanity cap (3x deviation rejected)
        └───────────┬───────────┘
                    ▼
        Scale per-100g macros to portion weight
        Accumulate calories, protein, carbs, fat
```

### Weight Parsing

The parser handles:
- Decimal quantities: `6.5 oz`
- Fractions: `1/2 cup`
- Mixed fractions: `1 1/2 tbsp`
- Unitless items: `1 hamburger bun` (uses `NO_UNIT_WEIGHTS` lookup)

### Context-Aware Weight Tables

| Table | Example |
|---|---|
| `SLICE_WEIGHTS` | "1 slice bacon" → 8g, "1 slice cheddar" → 21g |
| `PIECE_WEIGHTS` | "1 egg" → 50g, "1 wing" → 30g |
| `CUP_WEIGHTS` | "1 cup spinach" → 30g, "1 cup chicken" → 140g |
| `NO_UNIT_WEIGHTS` | "1 hamburger bun" → 45g |

---

## Linear Programming (Calorie Optimizer)

The PuLP solver minimizes:

```
Objective = Σ(price × quantity) + penalties × slack_variables
```

| Penalty | Weight | Rationale |
|---|---|---|
| Protein slack | 10,000 | Highest priority — protein is hardest to hit |
| Calorie slack | 10,000 | Tied for highest — can't go over calorie ceiling |
| Carbs slack | 8,000 | Important but more flexible |
| Fats slack | 5,000 | Lowest priority — most foods already contain fats |

**Constraints:**
- `Σ(protein_i × qty_i) + slack_p ≥ target_protein`
- `Σ(carbs_i × qty_i) + slack_c ≥ target_carbs`
- `Σ(fats_i × qty_i) + slack_f ≥ target_fats`
- `Σ(calories_i × qty_i) - slack_cal ≤ target_calories`

**Decision variables:** integer quantities (you can't order 0.5 burgers).

**Result classification:**
- **Optimal** — all slack variables are zero (perfect macro match).
- **Best Effort** — some gaps remain but this is the closest feasible solution.
