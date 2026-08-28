# API Reference

MacroHunter exposes two backend services over HTTP. All backend engine endpoints use **Server-Sent Events (SSE)** for real-time streaming — responses are delivered as a stream of named events, not a single JSON body.

---

## Backend Engine (Port 8000)

### SSE Event Format

All endpoints below return `text/event-stream` responses. The frontend receives three types of events:

| Event | Description |
|---|---|
| `agent_update` | Progress update during pipeline execution |
| `done` | Final results payload — pipeline completed successfully |
| `error` | Error details — pipeline failed |

#### `agent_update` Event Data

```json
{
  "status": "processing",
  "headline": "🔍 Scanning menus at nearby restaurants...",
  "detail": "Found 3 restaurants to evaluate."
}
```

#### `done` Event Data

```json
{
  "status": "done",
  "headline": "Adding final touches...",
  "detail": "Sorting by price...",
  "results": [ /* array of Order Result Objects */ ]
}
```

#### `error` Event Data

```json
{
  "detail": "Error description string"
}
```

### Node-to-UI Message Translations

The backend translates internal graph node names into user-facing messages:

| Node | Headline | Detail |
|---|---|---|
| `find_restaurants` | 🔍 Scanning menus at nearby restaurants... | "Found {N} restaurants to evaluate." |
| `fetch_and_optimize` | 🧬 Calculating macronutrient balances... | "Matching items against your target protein and calories..." |
| `image_translation` | 🧬 Calculating macros... | "Extracting protein and calorie counts from menu..." |
| `optimizer` | Optimizing menu items... | "Optimizing {N} menu items..." |
| `judge` | Adding final touches... | "Sorting by price..." |

---

### `POST /api/optimize-meal`

Search for optimized meals at nearby restaurants. Returns an SSE stream.

**Content-Type:** `application/json`

#### Request Body

```json
{
  "searching_for_restaurant": true,
  "latitude": 42.3601,
  "longitude": -71.0589,
  "target_calories": 2000,
  "target_protein": 150,
  "target_carbs": 200,
  "target_fats": 60
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `searching_for_restaurant` | `bool` | Yes | Must be `true` for this endpoint |
| `latitude` | `float` | Yes | User's GPS latitude |
| `longitude` | `float` | Yes | User's GPS longitude |
| `target_calories` | `float` | Yes | Daily calorie ceiling |
| `target_protein` | `float` | Yes | Target protein in grams |
| `target_carbs` | `float` | Yes | Target carbs in grams |
| `target_fats` | `float` | Yes | Target fats in grams |

#### Response

SSE stream. The stream immediately yields an initial event to update the UI:
```json
{
  "status": "processing",
  "headline": "🔍 Finding restaurants near you...",
  "detail": ""
}
```
The final `done` event contains `results` — an array of Order Result Objects (see [Response Schema Reference](#response-schema-reference)).

---

### `POST /api/optimize-menu-image-stream`

Upload a menu photo as base64-encoded JSON and get optimized meal suggestions. Returns an SSE stream.

> **This is the primary image endpoint** used by the Expo frontend's scan screen.

**Content-Type:** `application/json`

#### Request Body

```json
{
  "image_b64": "<base64-encoded image string>",
  "target_calories": 2000,
  "target_protein": 150,
  "target_carbs": 200,
  "target_fats": 60
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `image_b64` | `string` | Yes | Base64-encoded image data |
| `target_calories` | `float` | Yes | Daily calorie ceiling |
| `target_protein` | `float` | Yes | Target protein in grams |
| `target_carbs` | `float` | Yes | Target carbs in grams |
| `target_fats` | `float` | Yes | Target fats in grams |

#### Response

SSE stream. The stream immediately yields an initial event to update the UI:
```json
{
  "status": "processing",
  "headline": "📷 Reading menu layout and identifying items...",
  "detail": ""
}
```
The final `done` event contains `results` — an array of Order Result Objects where the `restaurant` field will be a string like `"Uploaded Menu (Option 1)"`.

---

### `POST /api/optimize-menu-image`

Upload a menu photo as multipart form-data and get optimized meal suggestions. Returns an SSE stream.

> **Legacy fallback** — the frontend primarily uses `/api/optimize-menu-image-stream` instead.

**Content-Type:** `multipart/form-data`

#### Request Fields

| Field | Type | Required | Description |
|---|---|---|---|
| `target_calories` | `float` (form) | Yes | Daily calorie ceiling |
| `target_protein` | `float` (form) | Yes | Target protein in grams |
| `target_carbs` | `float` (form) | Yes | Target carbs in grams |
| `target_fats` | `float` (form) | Yes | Target fats in grams |
| `file` | `UploadFile` | Yes | Image file (JPEG, PNG, etc.) |

#### Response

SSE stream. Same event format and result structure as `/api/optimize-menu-image-stream`.

---

## Image Scanner Service (Port 8001)

### `POST /translate-menu`

Translates a menu image into structured nutrition data.

> **Note:** This is an internal service called by the backend engine's `image_translation` graph node. It is not intended to be called directly by the frontend.

**Content-Type:** `multipart/form-data`

#### Request

| Field | Type | Required | Description |
|---|---|---|---|
| `file` | `UploadFile` | Yes | Image of a restaurant menu |

#### Processing Pipeline

1. Gemini 2.5 Flash Vision extracts menu items and raw ingredients (with structured output schema)
2. Ingredients are named using USDA-style format (e.g., "Beef, ground, 80% lean, raw")
3. Portion sizes are estimated for large restaurant servings
4. Prices are extracted from the menu image (default: $10.00 if not visible)
5. Each ingredient is analyzed via `ingredient_analyzer` for USDA macro lookup
6. Final results include per-item macros and prices

#### Response

```json
[
  {
    "name": "Classic Burger",
    "calories": 850,
    "protein": 45,
    "carbs": 55,
    "fats": 42,
    "price": 12.99
  }
]
```

---

## Response Schema Reference

### Order Result Object

| Field | Type | Description |
|---|---|---|
| `status` | `string` | `"Optimal"` or `"Best Effort"` |
| `total_cost` | `float` | Estimated total price in USD |
| `achieved_macros` | `object` | `{ cal, p, c, f }` — what the order actually provides |
| `gaps` | `object` | `{ cal, p, c, f }` — shortfall from targets (0 = perfect) |
| `order` | `array` | List of `{ item, quantity, estimated }` |
| `restaurant` | `string \| object` | Restaurant name (vision path) or full restaurant object (search path) |
| `estimated` | `bool` | `true` if macros were AI-estimated (not from a nutrition database) |

### Restaurant Object (Search Path)

| Field | Type | Description |
|---|---|---|
| `name` | `string` | Restaurant name |
| `address` | `string` | Street address |
| `rating` | `float` | Google rating (1–5) |
| `total_ratings` | `int` | Number of Google ratings |
| `photo_url` | `string \| null` | Google Places photo URL |
| `latitude` | `float` | Restaurant latitude coordinate |
| `longitude` | `float` | Restaurant longitude coordinate |

### Order Item Object

| Field | Type | Description |
|---|---|---|
| `item` | `string` | Menu item name |
| `quantity` | `int` | Number to order |
| `estimated` | `bool` | `true` if macros were AI-estimated (not from a nutrition database) |
