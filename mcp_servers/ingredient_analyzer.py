from google.genai import file_search_stores
import os
from pydantic import BaseModel
from usda_fdc import FdcClient
from dotenv import load_dotenv
from mcp.server.fastmcp import FastMCP
import json
import re

load_dotenv()

mcp = FastMCP("USDA FDC Ingredient Analyzer")

USDA_KEY = os.getenv("USDA_API_KEY")
client = FdcClient(api_key=USDA_KEY)


# ─── Context-aware ingredient weight tables ──────────────────────────────
# The USDA returns macros per 100g, so getting the portion weight right is
# critical.  These tables map ingredient keywords to realistic per-unit
# gram weights for ambiguous units like "slice" and "piece".

SLICE_WEIGHTS: dict[str, float] = {
    # Thin condiment / garnish slices
    "pickle": 7.0, "gherkin": 7.0, "jalapeño": 4.0, "jalapeno": 4.0,
    "pepperoni": 2.0, "olive": 3.0,
    # Produce slices
    "tomato": 15.0, "onion": 10.0, "cucumber": 7.0, "avocado": 30.0,
    "mushroom": 6.0, "pepper": 10.0, "bell pepper": 10.0,
    # Cheese slices (standard deli slice)
    "cheese": 21.0, "cheddar": 21.0, "swiss": 21.0, "american": 19.0,
    "provolone": 21.0, "mozzarella": 21.0, "pepper jack": 21.0,
    # Bread slices
    "bread": 30.0, "toast": 30.0, "sourdough": 30.0, "rye": 30.0,
    # Deli meat slices
    "ham": 28.0, "turkey": 28.0, "roast beef": 28.0, "salami": 10.0,
    "prosciutto": 15.0,
    # Bacon
    "bacon": 8.0,
}

PIECE_WEIGHTS: dict[str, float] = {
    # Bread / wraps
    "bun": 45.0, "roll": 45.0, "tortilla": 45.0, "wrap": 60.0, "pita": 60.0,
    "flatbread": 60.0, "naan": 90.0, "croissant": 45.0, "biscuit": 45.0,
    # Proteins
    "patty": 113.0, "burger patty": 113.0,
    "nugget": 18.0, "tender": 30.0, "strip": 25.0,
    "wing": 30.0, "drumstick": 75.0, "thigh": 115.0, "breast": 170.0,
    "egg": 50.0, "sausage link": 45.0, "sausage": 45.0,
    "hot dog": 45.0, "frank": 45.0,
    "fish fillet": 90.0, "shrimp": 6.0,
    "wonton": 20.0, "egg roll": 80.0, "spring roll": 45.0, "dumpling": 25.0,
    "potsticker": 30.0, "crab rangoon": 25.0,
    # Produce (whole pieces)
    "lettuce": 8.0, "leaf": 5.0, "tomato": 120.0, "onion ring": 15.0,
    "pickle spear": 35.0,
    # Small items
    "crouton": 3.0, "cookie": 30.0, "muffin": 60.0,
    "donut": 55.0, "doughnut": 55.0,
    "waffle": 75.0, "pancake": 40.0,
    # Cheese (single piece / wedge)
    "cheese": 21.0,
}

CUP_WEIGHTS: dict[str, float] = {
    # Leafy greens (very fluffy)
    "lettuce": 35.0, "spinach": 30.0, "kale": 20.0, "mixed greens": 30.0, "arugula": 20.0,
    # Other fluffy/light items
    "crouton": 30.0, "popcorn": 8.0, "cereal": 40.0,
    # Chopped veggies
    "onion": 160.0, "tomato": 150.0, "carrot": 110.0, "cucumber": 140.0, "broccoli": 90.0,
    "mushroom": 70.0, "pepper": 150.0,
    # Grated cheese
    "cheese": 113.0, "cheddar": 113.0, "mozzarella": 113.0, "parmesan": 85.0,
    # Meats
    "chicken": 140.0, "beef": 150.0, "bacon": 115.0,
}

# Fallback weights when no unit is recognized (e.g., "1 hamburger bun")
NO_UNIT_WEIGHTS: dict[str, float] = {
    **PIECE_WEIGHTS,
    "sauce": 15.0, "dressing": 30.0, "mayo": 15.0, "mayonnaise": 15.0,
    "ketchup": 15.0, "mustard": 5.0, "relish": 15.0, "syrup": 30.0,
    "butter": 14.0, "cream cheese": 28.0, "sour cream": 30.0,
    "guacamole": 30.0, "salsa": 30.0, "gravy": 60.0,
}

# ─── Hardcoded fallback macros for common ingredients ─────────────────────
# These are ingredients that USDA search consistently fails on (e.g., the
# search returns an fdc_id that 404s, or matches a completely wrong food).
# Values are per 100g from authoritative sources.
COMMON_FALLBACKS: dict[str, dict[str, float]] = {
    "egg":          {"cal": 155.0, "p": 13.0, "c": 1.1, "f": 11.0, "serving_g": 50.0},
    "egg white":    {"cal":  52.0, "p": 11.0, "c": 0.7, "f": 0.2, "serving_g": 33.0},
    "egg yolk":     {"cal": 322.0, "p": 16.0, "c": 3.6, "f": 27.0, "serving_g": 17.0},
    "white rice":   {"cal": 130.0, "p":  2.7, "c": 28.0, "f": 0.3, "serving_g": 175.0},
    "cooked rice":  {"cal": 130.0, "p":  2.7, "c": 28.0, "f": 0.3, "serving_g": 175.0},
    "brown rice":   {"cal": 123.0, "p":  2.7, "c": 26.0, "f": 1.0, "serving_g": 195.0},
    "flour tortilla":{"cal": 312.0, "p":  8.0, "c": 52.0, "f": 8.0, "serving_g": 45.0},
    "corn tortilla":{"cal": 218.0, "p":  5.7, "c": 44.6, "f": 2.8, "serving_g": 26.0},
    "béchamel":     {"cal":  90.0, "p":  3.0, "c": 5.5, "f": 6.0, "serving_g": 120.0},
    "bechamel":     {"cal":  90.0, "p":  3.0, "c": 5.5, "f": 6.0, "serving_g": 120.0},
    "lo mein noodles":{"cal": 138.0, "p": 4.6, "c": 25.0, "f": 2.0, "serving_g": 200.0},
    "sauce, general tso": {"cal": 230.0, "p": 1.0, "c": 45.0, "f": 5.0, "serving_g": 60.0},
    "sauce, orange chicken": {"cal": 220.0, "p": 1.0, "c": 45.0, "f": 4.0, "serving_g": 60.0},
    "sauce, sesame chicken": {"cal": 250.0, "p": 1.0, "c": 40.0, "f": 10.0, "serving_g": 60.0},
    "sauce, kung pao": {"cal": 180.0, "p": 2.0, "c": 25.0, "f": 8.0, "serving_g": 60.0},
    "sauce, mongolian beef": {"cal": 150.0, "p": 2.0, "c": 20.0, "f": 7.0, "serving_g": 60.0},
    "sauce, sweet and sour": {"cal": 150.0, "p": 0.1, "c": 38.0, "f": 0.1, "serving_g": 60.0},
}


def _try_common_fallback(ing_name: str, ing_weight: float):
    """Check if an ingredient matches a common fallback entry.
    Returns (calories, protein, carbs, fat) or None if no match."""
    name_lower = ing_name.lower()
    for keyword in sorted(COMMON_FALLBACKS.keys(), key=len, reverse=True):
        if re.search(r'\b' + re.escape(keyword) + r'\b', name_lower):
            fb = COMMON_FALLBACKS[keyword]
            scale = ing_weight / 100.0
            return (fb["cal"] * scale, fb["p"] * scale, fb["c"] * scale, fb["f"] * scale)
    return None


def _lookup_ingredient_weight(ingredient_name: str, table: dict[str, float], default: float) -> float:
    """Find the best per-unit weight for an ingredient by matching keywords.
    Longer (more specific) keys are checked first. Secondary sort is reverse alphabetical."""
    name_lower = ingredient_name.lower()
    for keyword in sorted(table.keys(), key=lambda k: (len(k), k), reverse=True):
        if keyword in name_lower:
            return table[keyword]
    return default


class FoodItem(BaseModel):
    item: str
    calories: float
    protein: float
    carbs: float
    fat: float

def parse_ingredient_weight(ingredient_str: str) -> tuple[str, float]:
    """
    Parses an ingredient string (e.g. '1 oz cheddar cheese' or '50 grams ketchup')
    and returns (clean_ingredient_name, weight_in_grams).
    """
    ingredient_str = " ".join(ingredient_str.split()).strip()
    
    qty = None
    remaining = ingredient_str
    
    # Check mixed fraction first: e.g. "1 1/2"
    mixed_match = re.match(r'^(\d+)\s+(\d+)/(\d+)(.*)$', remaining, re.IGNORECASE)
    fraction_match = re.match(r'^(\d+)/(\d+)(.*)$', remaining, re.IGNORECASE)
    decimal_match = re.match(r'^(\d+(?:\.\d+)?)(.*)$', remaining, re.IGNORECASE)
    
    if mixed_match:
        try:
            whole = float(mixed_match.group(1))
            num = float(mixed_match.group(2))
            denom = float(mixed_match.group(3))
            qty = whole + (num / denom)
            remaining = mixed_match.group(4).strip()
        except Exception:
            qty = 1.0
    elif fraction_match:
        try:
            num = float(fraction_match.group(1))
            denom = float(fraction_match.group(2))
            qty = num / denom
            remaining = fraction_match.group(3).strip()
        except Exception:
            qty = 1.0
    elif decimal_match:
        try:
            qty = float(decimal_match.group(1))
            remaining = decimal_match.group(2).strip()
        except ValueError:
            qty = 1.0
            
    if remaining.lower().startswith("of "):
        remaining = remaining[3:].strip()
        
    name = remaining
    weight = 80.0 # fallback default weight for 1 piece
    
    if qty is not None:
        # Units list with negative lookahead to avoid matching word prefixes
        units_patterns = [
            (r'^(tablespoons|tablespoon|tbsp)(?![a-zA-Z])(.*)$', 15.0),
            (r'^(teaspoons|teaspoon|tsp)(?![a-zA-Z])(.*)$', 5.0),
            (r'^(fluid ounces|fluid ounce|fl oz|fl\. oz\.)(?![a-zA-Z])(.*)$', 29.57),
            (r'^(ounces|ounce|oz)(?![a-zA-Z])(.*)$', 28.35),
            (r'^(pounds|pound|lb)(?![a-zA-Z])(.*)$', 453.59),
            (r'^(milliliters|milliliter|ml)(?![a-zA-Z])(.*)$', 1.0),
            (r'^(grams|gram|g)(?![a-zA-Z])(.*)$', 1.0),
            (r'^(cups|cup)(?![a-zA-Z])(.*)$', 240.0),
            (r'^(slices|slice)(?![a-zA-Z])(.*)$', 28.0),
            (r'^(pieces|piece)(?![a-zA-Z])(.*)$', 50.0),
        ]
        
        matched_unit = False
        for pattern, factor in units_patterns:
            unit_match = re.match(pattern, remaining, re.IGNORECASE)
            if unit_match:
                name = unit_match.group(2).strip() if len(unit_match.groups()) > 1 else unit_match.group(1).strip()
                unit_text = unit_match.group(1).lower()

                # Use context-aware weights for ambiguous units
                if "slice" in unit_text:
                    factor = _lookup_ingredient_weight(name, SLICE_WEIGHTS, 28.0)
                elif "piece" in unit_text:
                    factor = _lookup_ingredient_weight(name, PIECE_WEIGHTS, 50.0)
                elif "cup" in unit_text:
                    factor = _lookup_ingredient_weight(name, CUP_WEIGHTS, 240.0)

                weight = qty * factor
                matched_unit = True
                break
                
        if not matched_unit:
            # e.g. "1 bun" -> use ingredient-specific weight lookup
            weight = qty * _lookup_ingredient_weight(remaining, NO_UNIT_WEIGHTS, 50.0)
    else:
        # No quantity found, check if it starts with unit + "of" (e.g. "cup of milk")
        unit_word_patterns = [
            (r'^(tablespoon|tbsp)\s+of\s+(.*)$', 15.0),
            (r'^(teaspoon|tsp)\s+of\s+(.*)$', 5.0),
            (r'^(fluid ounce|fl oz|fl\. oz\.)\s+of\s+(.*)$', 29.57),
            (r'^(ounce|oz)\s+of\s+(.*)$', 28.35),
            (r'^(pound|lb)\s+of\s+(.*)$', 453.59),
            (r'^(milliliter|ml)\s+of\s+(.*)$', 1.0),
            (r'^(gram|g)\s+of\s+(.*)$', 1.0),
            (r'^(cup)\s+of\s+(.*)$', 240.0),
            (r'^(slice)\s+of\s+(.*)$', 28.0),
            (r'^(piece)\s+of\s+(.*)$', 50.0),
        ]
        
        matched_unit = False
        for pattern, factor in unit_word_patterns:
            unit_match = re.match(pattern, remaining, re.IGNORECASE)
            if unit_match:
                name = unit_match.group(2).strip()
                weight = 1.0 * factor
                matched_unit = True
                break
                
        if not matched_unit:
            name = ingredient_str
            weight = _lookup_ingredient_weight(ingredient_str, NO_UNIT_WEIGHTS, 50.0)
            
    if name.lower().startswith("of "):
        name = name[3:].strip()
        
    return name, weight


# Words to ignore when comparing ingredient queries to USDA descriptions
_STOPWORDS = {"of", "the", "a", "an", "and", "or", "with", "in", "for", "to",
              "raw", "fresh", "dried", "cooked", "large", "small", "medium",
              "thin", "thick", "diced", "sliced", "chopped", "minced",
              "shredded", "grated", "crushed", "ground", "whole"}

# Unit/shape words that should never be treated as the core ingredient noun
_UNIT_WORDS = {"slice", "slices", "piece", "pieces", "cup", "cups",
               "ring", "rings", "strip", "strips", "chunk", "chunks",
               "spear", "spears", "wedge", "wedges", "leaf", "leaves",
               "clove", "cloves", "stalk", "stalks", "head", "heads",
               "tbsp", "tsp", "oz", "lb", "gram", "grams", "ml"}


def _extract_words(text: str) -> set[str]:
    """Extract meaningful words from a text string, filtering out stopwords."""
    words = set(re.sub(r'[^\w\s]', '', text.lower()).split())
    return words - _STOPWORDS


def _core_noun(query: str) -> str:
    """Extract the most important noun from an ingredient query.
    E.g., 'diced red onion' -> 'onion', 'dill pickle slices' -> 'pickle'."""
    words = re.sub(r'[^\w\s]', '', query.lower()).split()
    # Walk backwards — the core noun is usually the last meaningful word
    # that isn't a stopword or a unit/shape word
    for word in reversed(words):
        if word not in _STOPWORDS and word not in _UNIT_WORDS and len(word) > 2:
            return word
    # If everything was filtered, fall back to the longest remaining word
    candidates = [w for w in words if w not in _STOPWORDS]
    return max(candidates, key=len) if candidates else (words[-1] if words else "")


def _score_usda_match(query: str, description: str) -> float:
    """Score how well a USDA result description matches the search query.
    Uses precision-recall style scoring: rewards overlap, penalizes extra junk."""
    query_words = _extract_words(query)
    desc_words = _extract_words(description)
    if not query_words or not desc_words:
        return 0.0
    overlap = query_words & desc_words
    if not overlap:
        return 0.0
    # Recall: how many query words appear in the description
    recall = len(overlap) / len(query_words)
    # Precision: penalize descriptions with lots of irrelevant words
    precision = len(overlap) / len(desc_words)
    # F1-style harmonic mean
    return 2.0 * (precision * recall) / (precision + recall)


def _best_usda_match(results, query: str):
    """Pick the USDA search result whose description best matches the query.
    Rejects any result where the core ingredient noun is completely absent."""
    if not results or not results.foods:
        return None
    core = _core_noun(query)
    best = None
    best_score = -1.0
    for food in results.foods:
        desc = getattr(food, "description", "") or ""
        desc_lower = desc.lower()
        # Hard reject: if the core ingredient noun isn't in the description at all,
        # this is almost certainly a bad match (e.g., "onion" -> "Bread, onion")
        if core and core not in desc_lower:
            continue
        score = _score_usda_match(query, desc)
        if score > best_score:
            best_score = score
            best = food
    # If every result was rejected, fall back to the first one but log a warning
    if best is None:
        print(f"  !! No good USDA match for '{query}' — all results rejected")
        best = results.foods[0]
    return best


def _get_portion_weight_from_usda(food_detail, ingredient_str: str, parsed_weight: float) -> float:
    """Check USDA's own portion data for a more accurate gram weight.
    Falls back to parsed_weight when no matching portion is found."""
    portions = getattr(food_detail, "food_portions", None) or []
    if not portions:
        return parsed_weight

    unit_keywords = ["slice", "piece", "cup", "tablespoon", "tbsp",
                     "teaspoon", "tsp", "ounce", "oz", "pound", "lb"]

    ing_lower = ingredient_str.lower()
    matched_unit = None
    for kw in unit_keywords:
        if kw in ing_lower:
            matched_unit = kw
            break

    if not matched_unit:
        return parsed_weight

    for portion in portions:
        desc = str(getattr(portion, "portion_description", "")
                   or getattr(portion, "modifier", "") or "").lower()
        gram_wt = getattr(portion, "gram_weight", None)
        if gram_wt and matched_unit in desc:
            qty_match = re.match(r'^(\d+(?:\.\d+)?)', ingredient_str.strip())
            qty = float(qty_match.group(1)) if qty_match else 1.0
            amount = getattr(portion, "amount", 1.0) or 1.0
            usda_weight = qty * (gram_wt / amount)
            # Sanity cap: reject overrides that deviate more than 3x from our
            # parsed estimate — these are almost always caused by a bad USDA
            # match (e.g., mascarpone -> 'rice mixture with cheese').
            if parsed_weight > 0 and (usda_weight > parsed_weight * 3.0 or usda_weight < parsed_weight / 3.0):
                print(f"  !! USDA portion override rejected (too far off): "
                      f"{ingredient_str} = {usda_weight:.1f}g vs parsed {parsed_weight:.1f}g")
            else:
                print(f"  -> USDA portion override: {ingredient_str} = {usda_weight:.1f}g "
                      f"(was {parsed_weight:.1f}g)")
                return usda_weight

    return parsed_weight


@mcp.tool()
def analyze_ingredient(food_items: list[dict]) -> list[FoodItem]:
    """
    Takes in a list of food items and analyzes the ingredients to get the macros for each item.
    Uses the USDA FDC API to search for each food by name and pull nutrient data per 100g.
    """
    food_list: list[FoodItem] = []

    for food_item in food_items:
        # Initialize variables
        calories = 0.0
        protein = 0.0
        carbs = 0.0
        fat = 0.0

        # Split and analyze ingredients if present
        query = food_item.get("ingredients") or food_item.get("item", "")
        if isinstance(query, list):
            ingredients_list = [ing.strip() for ing in query if ing.strip()]
        elif isinstance(query, str):
            ingredients_list = [ing.strip() for ing in query.split(",") if ing.strip()]
        else:
            ingredients_list = []

        found_any_ingredient = False

        for ing in ingredients_list:
            ing_name, ing_weight = parse_ingredient_weight(ing)
            if not ing_name:
                continue

            # ── Check hardcoded fallbacks first for ingredients USDA consistently fails on ──
            fallback = _try_common_fallback(ing_name, ing_weight)
            if fallback is not None:
                fb_cal, fb_p, fb_c, fb_f = fallback
                calories += fb_cal
                protein += fb_p
                carbs += fb_c
                fat += fb_f
                found_any_ingredient = True
                print(f"Parsed '{ing_name}': portion={ing_weight}g, using hardcoded fallback")
                continue

            results = None
            try:
                # Remove parentheses/brackets and replace slashes with space to avoid USDA search 400 Bad Request
                clean_query = re.sub(r'[()\[\]{}/]', ' ', ing_name).strip()
                results = client.search(clean_query, page_size=3)
            except Exception as e:
                print(f"USDA search failed for ingredient '{ing_name}': {e}")

            # Fallback to raw ingredient query if no result
            if not results or not results.foods:
                try:
                    clean_raw = re.sub(r'[()\[\]{}/]', ' ', ing).strip()
                    results = client.search(clean_raw, page_size=3)
                except Exception as e:
                    print(f"USDA fallback search failed for ingredient '{ing}': {e}")

            if results and results.foods:
                try:
                    top_result = _best_usda_match(results, ing_name)
                    if top_result is None:
                        raise ValueError(f"No USDA match found for '{ing_name}'")
                    fdc_id = top_result.fdc_id
                    food_detail = client.get_food(fdc_id)
                    nutrient_list = getattr(food_detail, "nutrients", [])

                    # Try USDA's own portion data before falling back to our parsed weight
                    ing_weight = _get_portion_weight_from_usda(food_detail, ing, ing_weight)
                    # Scale per-100g amounts to portion weight
                    scale = ing_weight / 100.0
                    has_added_nutrients = False

                    for n in nutrient_list:
                        name = getattr(n, "name", "").lower()
                        unit = getattr(n, "unit_name", "").lower()
                        amount = getattr(n, "amount", 0) or 0
                        scaled_amount = amount * scale

                        if "energy" in name and unit == "kcal":
                            calories += scaled_amount
                            has_added_nutrients = True
                        elif name == "protein":
                            protein += scaled_amount
                            has_added_nutrients = True
                        elif "carbohydrate, by difference" in name:
                            carbs += scaled_amount
                            has_added_nutrients = True
                        elif "total lipid (fat)" in name:
                            fat += scaled_amount
                            has_added_nutrients = True

                    if has_added_nutrients:
                        found_any_ingredient = True
                        print(f"Parsed '{ing_name}': portion={ing_weight}g, matching USDA food='{top_result.description}'")
                except Exception as e:
                    print(f"Error fetching/parsing details for ingredient '{ing_name}': {e}")

        # Fallback to searching the main item name if ingredients analysis returned 0
        if not found_any_ingredient:
            item_name = food_item.get("item", "")
            if item_name:
                try:
                    print(f"No ingredients resolved. Searching USDA for item name directly: '{item_name}'")
                    clean_item = re.sub(r'[()\[\]{}]', '', item_name)
                    results = client.search(clean_item, page_size=3)
                    if results and results.foods:
                        top_result = _best_usda_match(results, item_name)
                        if top_result is None:
                            raise ValueError(f"No USDA match found for '{item_name}'")
                        fdc_id = top_result.fdc_id
                        food_detail = client.get_food(fdc_id)
                        nutrient_list = getattr(food_detail, "nutrients", [])

                        # Estimate standard serving size if listed in USDA
                        serving_size = getattr(food_detail, "serving_size", None)
                        scale = (serving_size / 100.0) if serving_size else 1.5  # default to 150g serving

                        for n in nutrient_list:
                            name = getattr(n, "name", "").lower()
                            unit = getattr(n, "unit_name", "").lower()
                            amount = getattr(n, "amount", 0) or 0
                            scaled_amount = amount * scale

                            if "energy" in name and unit == "kcal":
                                calories += scaled_amount
                            elif name == "protein":
                                protein += scaled_amount
                            elif "carbohydrate, by difference" in name:
                                carbs += scaled_amount
                            elif "total lipid (fat)" in name:
                                fat += scaled_amount
                except Exception as e:
                    print(f"USDA fallback search failed for item '{item_name}': {e}")

        food_list.append(
            FoodItem(
                item=food_item["item"],
                calories=float(round(calories)),
                protein=float(round(protein)),
                carbs=float(round(carbs)),
                fat=float(round(fat)),
            )
        )

    return food_list


if __name__ == "__main__":
    print(analyze_ingredient([{"item": "Cheeseburger", "ingredients": ["6 oz ground beef patty", "1 slice of cheddar cheese","hamburger bun","1 large leaf of lettuce","2 slices of tomato","2 thin rings of onion","3 dill pickle slices","1 tbsp ketchup","1 tbsp mayonnaise","1 tsp mustard"]}]))