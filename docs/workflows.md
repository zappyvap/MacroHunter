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
                │  (restaurant 0) │       │  (restaurant 1) │      │  (restaurant N) │
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
   - Uses Google Places Nearby Search API with pagination (`next_page_token`).
   - Returns up to **15 restaurants** (controlled by `RESULT_LIMIT` in `restaurant_finder.py`).
   - Each restaurant includes: name, address, rating, total_ratings, photo_url, latitude, longitude.
   - Writes `restaurant_list` to state.

3. **Fan-Out** (`fan_out_restaurants`)
   - Uses LangGraph `Send()` to spawn one parallel `fetch_and_optimize` branch per restaurant.
   - Each branch receives its own `current_restaurant_index` so branches don't interfere with each other.
   - LangGraph fires all branches simultaneously instead of looping sequentially.

4. **Fetch & Optimize** (`fetch_and_optimize`) — *runs in parallel*
   - **Menu Retrieval** — calls `chain_reader(restaurant_name)`:
     - Checks Supabase cache first (see [Caching Workflow](#caching-workflow)).
     - For known chains (39 chains in `KNOWN_CHAINS` list) → FatSecret API (OAuth 2.0 token exchange, search, macro parsing with serving normalization).
     - For unknown restaurants → Gemini AI estimation (structured output for ingredients + USDA lookup via `run_analyze_ingredient()`).
     - Price estimation via Gemini for both paths (structured output with `list[ItemPrice]` schema).
     - Menu normalization via `_normalize_menu()` to ensure consistent field names.
   - **Calorie Optimization** — calls `calorie_optimizer(menu, targets)`:
     - Builds a PuLP linear program: minimize cost + macro gap penalties.
     - Decision variables: integer quantity of each menu item (capped at 3 per item).
     - Constraints: hit protein/carbs/fats targets, stay under calorie ceiling.
     - Returns optimal order, achieved macros, gaps, cost, and status.
   - Each branch writes its result (wrapped with the full restaurant object) to `best_orders` using the `add` reducer for safe parallel writes.

5. **Judge** (`judge_node`)
   - Receives all `best_orders` from every parallel branch.
   - Sorts by: (1) total macro gap ascending (sum of protein + carbs + fats gaps), (2) total cost ascending as tiebreaker.
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
   - Sends image to the **Scanner** service (`POST http://scanner:8001/translate-menu`, falls back to `127.0.0.1` when not in Docker).
   - The Scanner uses Gemini 2.5 Flash Vision with structured output (`list[RestaurantItems]` schema) to:
     - Extract menu items and their raw ingredients from the image.
     - Use USDA-style naming for ingredients (e.g., "Beef, ground, 80% lean, raw").
     - Estimate large restaurant portion sizes (fast food vs. sit-down calibrated).
     - Extract prices visible on the menu (defaults to $10.00 if not visible).
   - The `run_analyze_ingredient()` function then calculates macros from USDA data for each ingredient.
   - All scanned items are marked as `estimated: true` since macros are AI-derived.
   - Writes `menu_items` to state.

3. **Optimize Calories** (`optimize_calories`)
   - Runs the PuLP solver up to **3 times** to generate multiple order options.
   - After each run, removes the items used in that order from the pool to force diverse alternatives.
   - Each result is tagged as `"Uploaded Menu (Option N)"` for the restaurant field.
   - Writes all options to `best_orders`.

4. **Judge** (`judge_node`)
   - Same ranking logic as the Search Path.

5. **Response**
   - `engine.py` streams progress via SSE `agent_update` events to the scan screen.
   - The scan screen displays each update as animated step text with a progress bar.
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
   │  menu_cache      │                   (_normalize_menu applied)
   └────────┬─────────┘
            │ MISS or STALE (>7 days)
            ▼
   ┌──────────────────┐
   │  Is it a known   │── YES ──▶ FatSecret API + Gemini price estimation
   │  chain? (39 in   │
   │  KNOWN_CHAINS)   │
   └────────┬─────────┘
            │ NO
            ▼
   Gemini AI full menu estimation
   (structured output: items + ingredients)
   + USDA ingredient analysis
   (via run_analyze_ingredient)
   + Gemini price estimation
            │
            ▼
   Save to Supabase cache (upsert)
   Return menu
```

- **Cache key:** lowercase, trimmed restaurant name (`_cache_key()`).
- **Staleness:** controlled by `CACHE_MAX_AGE_DAYS` (currently set to **7 days**). Set to 0 to force re-fetch every time (useful for debugging/benchmarking).
- **Upsert:** uses Supabase `upsert` with `restaurant_name` as primary key, storing the full menu as JSONB plus a `cached_at` timestamp.
- **Failure tolerance:** cache read/write errors are caught and logged but never crash the pipeline — the system falls back to live fetching.

### Automated Cache Warming

To ensure fast response times for popular locations, a GitHub Action (`.github/workflows/daily-caching.yml`) runs automatically on the **1st and 15th of every month** (7 AM UTC). It executes `backend/scripts/caching-script.py`, which:
1. Simulates a location search using the Google Places API for a predefined location (configurable in `backend/scripts/caching-script.py`, radius: 5 miles).
2. Loops through all discovered restaurants and executes `search_chain_restaurant()`.
3. Pre-populates or refreshes the Supabase `menu_cache` before users actually search for those restaurants.

The workflow can also be triggered manually via `workflow_dispatch`.

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
        │  Check hardcoded      │  Eggs, rice, tortillas, sauces, steamed buns,
        │  fallback table       │  breaded chicken/fish, and specific Asian sauces.
        │  (COMMON_FALLBACKS)   │  Per-100g values from authoritative sources.
        │  ~20 entries          │  Matched via word-boundary regex.
        └───────────┬───────────┘
                    │ No match
                    ▼
        ┌───────────────────────┐
        │  USDA FDC API search  │  page_size=3, with _RetryClient
        │  + best_match scoring │  (6 retries, exponential backoff,
        │  (_best_usda_match)   │   in-memory search + food cache)
        └───────────┬───────────┘
                    ▼
        ┌───────────────────────┐
        │  Core noun validation │  _core_noun() extracts the main ingredient
        │  (hard reject)        │  word; rejects USDA results where it's absent
        │                       │  (e.g., "onion" → "Bread, onion" rejected)
        └───────────┬───────────┘
                    ▼
        ┌───────────────────────┐
        │  Precision-recall     │  _score_usda_match() computes F1-style
        │  scoring              │  score to pick the best of 3 results
        └───────────┬───────────┘
                    ▼
        ┌───────────────────────┐
        │  USDA portion weight  │  Cross-reference USDA's own portion data
        │  override (optional)  │  with sanity cap (3x deviation rejected)
        └───────────┬───────────┘
                    ▼
        Scale per-100g macros to portion weight
        Accumulate calories, protein, carbs, fat
                    │
                    ▼
        ┌───────────────────────┐
        │  Fallback: if no      │  Search USDA for the item name directly
        │  ingredients resolved │  (e.g., "Cheeseburger") with estimated
        │                       │  serving size (USDA or 150g default)
        └───────────────────────┘
```

### Weight Parsing

The parser (`parse_ingredient_weight()`) handles:
- Decimal quantities: `6.5 oz`
- Fractions: `1/2 cup`
- Mixed fractions: `1 1/2 tbsp`
- "of" constructions: `cup of milk`, `slice of cheese`
- Unitless items: `1 hamburger bun` (uses `NO_UNIT_WEIGHTS` lookup)
- No quantity at all: `ketchup` (uses `NO_UNIT_WEIGHTS` with qty=1)

### Context-Aware Weight Tables

| Table | Example |
|---|---|
| `SLICE_WEIGHTS` | "1 slice bacon" → 8g, "1 slice cheddar" → 21g, "1 slice tomato" → 15g |
| `PIECE_WEIGHTS` | "1 egg" → 50g, "1 wing" → 30g, "1 nugget" → 18g, "1 bun" → 45g |
| `CUP_WEIGHTS` | "1 cup spinach" → 30g, "1 cup chicken" → 140g, "1 cup cheese" → 113g |
| `NO_UNIT_WEIGHTS` | "1 hamburger bun" → 45g, "ketchup" → 15g, "butter" → 14g |

Longer (more specific) keys are checked first so "pepper jack" matches before "pepper".

### Concurrency & Rate Limiting

`run_analyze_ingredient()` processes all ingredients concurrently using `asyncio.gather()` with a `Semaphore(2)` to avoid overwhelming the USDA API. When called from within a running event loop (LangGraph's `astream`), it detects this and spawns a fresh event loop on a background thread via `concurrent.futures.ThreadPoolExecutor` to avoid deadlocking.

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
- `qty_i ≤ 3` for all items (prevents stacking unrealistic quantities of one dish)

**Decision variables:** integer quantities (you can't order 0.5 burgers).

**Result classification:**
- **Optimal** — all macro slack variables (protein + carbs + fats) are zero (perfect match).
- **Best Effort** — some gaps remain but this is the closest feasible solution.

---

## Match Scoring

The frontend calculates a **match score** for each result:

```javascript
const totalGap = (result.gaps.p || 0) + (result.gaps.c || 0) + (result.gaps.f || 0);
const score = Math.max(0, Math.round(100 - totalGap));
```

- **100%** = perfect macro match (all gaps are 0)
- **90%+** = high match (green `ScoreTag`)
- **75–89%** = medium match (yellow `ScoreTag`)
- **<75%** = low match (red `ScoreTag`)

---

## Result Filtering & Sorting

The results page includes a **FilterLightbox** with three controls:

| Filter | Options | Default |
|---|---|---|
| **Sort By** | Best Match, Highest Protein, Highest Carbs, Highest Fats | Best Match |
| **Max Price** | Any, $10, $20, $30 | Any |
| **Verified Only** | Toggle on/off | Off |

- **Best Match** sorts by the match score formula above (highest first).
- **Highest [macro]** sorts by the achieved macro value in that category (descending).
- **Verified Only** filters out results where `estimated === true` (keeps only FatSecret-sourced results).
- **Max Price** filters out results where `total_cost` (or `price` for scanned items) exceeds the selected amount.

---

## SSE Progress Bar System

Both the search and scan screens use a **deceleration-based progress bar** that crawls toward per-step caps:

1. Each SSE `agent_update` event increments a step counter and sets a new progress cap: `cap = min(step / EXPECTED_STEPS, 0.95)`
2. A 150ms interval timer advances the bar toward the current cap, decelerating as it approaches: `increment = max(remaining * rate, minimum)`
3. The bar stops exactly at the cap and waits for the next SSE event to raise it
4. When the `done` event fires, the cap is set to 1.0 and the bar snaps to 100% with a 300ms animation

The scan screen uses a slower crawl rate (0.006 vs 0.04) because image processing typically takes 30–60 seconds.

Expected steps: **5 for search** (initial + find_restaurants + fetch_and_optimize + optimizer + judge), **4 for scan** (initial + image_translation + optimizer + judge).
