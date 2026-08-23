"""
Ground truth macro data for accuracy benchmarking.

Each restaurant entry contains items with their official macronutrient values.
These are compared against the pipeline's output to measure accuracy.

To add a new restaurant:
1. Find official nutrition data (restaurant website, published PDF, etc.)
2. Add an entry with the restaurant name exactly as it would be searched.
3. Include the source URL for reference.
4. List items with calories, protein, carbs, fats.

Notes:
- Chain restaurants (in KNOWN_CHAINS) test the FatSecret API path.
- Non-chain restaurants test the AI estimation path (Gemini + USDA).
- Values below are from official sources but should be periodically re-verified
  as restaurants update their menus and recipes.
"""

MACRO_KEYS = ("calories", "protein", "carbs", "fats")

GROUND_TRUTH = {
    # ── FatSecret path (chain restaurants) ────────────────────────────────────
    "McDonald's": {
        "source": "mcdonalds.com/us/en-us/about-our-food/nutrition-calculator",
        "path": "fatsecret",
        "items": {
            "Big Mac":                      {"calories": 580, "protein": 25, "carbs": 45, "fats": 34},
            "Quarter Pounder with Cheese":  {"calories": 520, "protein": 30, "carbs": 42, "fats": 26},
            "Chicken McNuggets":     {"calories": 410, "protein": 23, "carbs": 26, "fats": 24},  # 10pc
            "French Fries":                 {"calories": 480, "protein":  7, "carbs": 65, "fats": 23},  # Large
            "McChicken":                    {"calories": 390, "protein": 14, "carbs": 38, "fats": 20},
            "Filet-O-Fish":                 {"calories": 390, "protein": 16, "carbs": 39, "fats": 19},
            "Egg McMuffin":                 {"calories": 310, "protein": 17, "carbs": 30, "fats": 13},
        },
    },
    "Chick-fil-A": {
        "source": "chick-fil-a.com/nutrition-allergens",
        "path": "fatsecret",
        "items": {
            "Chick-fil-A Chicken Sandwich":       {"calories": 420, "protein": 28, "carbs": 40, "fats": 18},
            "Spicy Chicken Sandwich":             {"calories": 450, "protein": 28, "carbs": 42, "fats": 19},
            "Chick-fil-A Nuggets":                {"calories": 250, "protein": 27, "carbs": 11, "fats": 11},  # 8ct
            "Chick-fil-A Waffle Potato Fries":    {"calories": 420, "protein":  5, "carbs": 45, "fats": 24},  # Medium
        },
    },

    # ── AI estimation path ─────────────────────────────────────────────────────
    # We test the Gemini + USDA pipeline by running known chains through
    # estimate_menu_via_ai directly (bypassing the FatSecret shortcut).
    # This lets us compare AI-estimated macros against official nutrition data.
    "McDonald's (AI)": {
        "source": "mcdonalds.com/us/en-us/about-our-food/nutrition-calculator",
        "path": "ai_estimation",
        "search_name": "McDonald's",  # name passed to estimate_menu_via_ai
        "items": {
            "Big Mac":                      {"calories": 580, "protein": 25, "carbs": 45, "fats": 34},
            "Quarter Pounder with Cheese":  {"calories": 520, "protein": 30, "carbs": 42, "fats": 26},
            "Chicken McNuggets":            {"calories": 410, "protein": 23, "carbs": 26, "fats": 24},
            "McChicken":                    {"calories": 390, "protein": 14, "carbs": 38, "fats": 20},
            "Filet-O-Fish":                 {"calories": 390, "protein": 16, "carbs": 39, "fats": 19},
            "Egg McMuffin":                 {"calories": 310, "protein": 17, "carbs": 30, "fats": 13},
        },
    },
}
