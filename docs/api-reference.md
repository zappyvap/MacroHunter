# API Reference

MacroHunter exposes two backend services over HTTP.

---

## Backend Engine (Port 8000)

### `POST /api/optimize-meal`

Search for optimized meals at nearby restaurants.

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

```json
{
  "status": "success",
  "results": [
    {
      "status": "Optimal",
      "total_cost": 12.47,
      "achieved_macros": { "cal": 1850, "p": 148, "c": 195, "f": 58 },
      "gaps": { "cal": 0, "p": 0, "c": 0, "f": 0 },
      "order": [
        { "item": "Grilled Chicken Sandwich", "quantity": 2, "estimated": false }
      ],
      "restaurant": {
        "name": "Chick-fil-A",
        "address": "123 Main St",
        "rating": 4.5,
        "total_ratings": 1200,
        "photo_url": "https://maps.googleapis.com/..."
      }
    }
  ]
}
```

---

### `POST /api/optimize-menu-image`

Upload a menu photo and get optimized meal suggestions.

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

Same structure as `/api/optimize-meal`, but the `restaurant` field will be a string like `"Uploaded Menu (Option 1)"` instead of an object.

---

## Image Scanner Service (Port 8001)

### `POST /translate-menu`

Translates a menu image into structured nutrition data.

> **Note:** This is an internal service called by the backend engine. It is not intended to be called directly by the frontend.

**Content-Type:** `multipart/form-data`

#### Request

| Field | Type | Required | Description |
|---|---|---|---|
| `file` | `UploadFile` | Yes | Image of a restaurant menu |

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

### Restaurant Object (Search Path)

| Field | Type | Description |
|---|---|---|
| `name` | `string` | Restaurant name |
| `address` | `string` | Street address |
| `rating` | `float` | Google rating (1–5) |
| `total_ratings` | `int` | Number of Google ratings |
| `photo_url` | `string \| null` | Google Places photo URL |

### Order Item Object

| Field | Type | Description |
|---|---|---|
| `item` | `string` | Menu item name |
| `quantity` | `int` | Number to order |
| `estimated` | `bool` | `true` if macros were AI-estimated (not from a nutrition database) |
