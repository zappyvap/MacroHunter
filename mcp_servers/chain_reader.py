from typing import Literal
from pydantic import Field
import os
import requests
import json
import dotenv
from datetime import datetime, timezone, timedelta
from mcp.server.fastmcp import FastMCP
from google import genai
from google.genai.types import GenerateContentConfig
try:
    from supabase_client import supabase
except ModuleNotFoundError:
    from mcp_servers.supabase_client import supabase

try:
    from ingredient_analyzer import analyze_ingredient
except ModuleNotFoundError:
    from mcp_servers.ingredient_analyzer import analyze_ingredient

from pydantic import BaseModel

dotenv.load_dotenv()
client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
mcp = FastMCP("Chain Restaurant Menu Search Tool")

# ─── Supabase menu cache ──────────────────────────────────────────────────
# Fetching a restaurant's menu is the slow part of a search: it's either a
# FatSecret API call + a Gemini price-estimation call, or a full Gemini
# menu-estimation call. The same restaurants come up over and over for
# people searching nearby, so we cache the finished menu in Supabase and
# skip straight past FatSecret/Gemini on repeat lookups.

class Ingredient(BaseModel):
    name: str = Field(description="USDA-style food name: 'Food, descriptor, state'. Examples: 'Oil, canola', 'Onions, raw', 'Cheese, cheddar', 'Beef, ground, 80% lean, raw'. No quantities or preparation notes.")
    quantity: float = Field(description="Numeric amount")
    unit: Literal["oz", "g", "lb", "cup", "tbsp", "tsp", "slice", "piece", "ml"]

class RestaurantItems(BaseModel):
    itemName: str
    ingredients: list[Ingredient]


CACHE_TABLE = "menu_cache"
CACHE_MAX_AGE_DAYS = 1  # set to 0 to force a re-fetch and cache update every time

def _cache_key(restaurant_name: str) -> str:
    """Normalize the name so 'Applebee's' and 'applebee's' hit the same row."""
    return restaurant_name.strip().lower()

def _normalize_menu(menu: list, restaurant_name: str) -> list:
    normalized = []
    for item in menu:
        if not isinstance(item, dict):
            continue
        name = item.get("name") or item.get("item") or "Unknown Item"
        calories = float(item.get("calories") or item.get("cal") or item.get("Calories") or item.get("Cal") or 0.0)
        protein = float(item.get("protein") or item.get("Protein") or item.get("p") or item.get("P") or 0.0)
        carbs = float(item.get("carbs") or item.get("Carbs") or item.get("carb") or item.get("Carb") or item.get("c") or item.get("C") or 0.0)
        fats = float(item.get("fats") or item.get("Fats") or item.get("fat") or item.get("Fat") or item.get("f") or item.get("F") or 0.0)
        
        price = 10.0
        if "price" in item:
            try:
                price = float(item["price"])
            except (ValueError, TypeError):
                pass
                
        normalized.append({
            "name": name,
            "calories": calories,
            "protein": protein,
            "carbs": carbs,
            "fats": fats,
            "price": price,
            "restaurant": item.get("restaurant") or restaurant_name,
            "estimated": item.get("estimated", False)
        })
    return normalized

def _get_cached_menu(restaurant_name: str):
    """Returns the cached menu (a list) if we have a fresh one, otherwise None."""
    try:
        key = _cache_key(restaurant_name)
        result = supabase.table(CACHE_TABLE).select("*").eq("restaurant_name", key).execute()

        if not result.data:
            return None

        row: dict = result.data[0]  # type: ignore[assignment]
        cached_at = datetime.fromisoformat(row["cached_at"])
        age = datetime.now(timezone.utc) - cached_at

        if age > timedelta(days=CACHE_MAX_AGE_DAYS):
            return None  # stale, treat like a cache miss so it gets refreshed

        return row["menu"]
    except Exception as e:
        # Cache problems should never take down a search — just fall back
        # to fetching live, same as if nothing was cached.
        print(f"Cache read failed for '{restaurant_name}': {e}")
        return None

def _save_menu_to_cache(restaurant_name: str, menu_json: str):
    """Parses the menu JSON string and upserts it into the cache table."""
    try:
        menu = json.loads(menu_json)
        if not menu:  # don't bother caching empty/failed results
            return
        key = _cache_key(restaurant_name)
        supabase.table(CACHE_TABLE).upsert({
            "restaurant_name": key,
            "menu": menu,
            "cached_at": datetime.now(timezone.utc).isoformat(),
        }).execute()
    except Exception as e:
        print(f"Cache write failed for '{restaurant_name}': {e}")


# this function is just because FatSecret needs a OAuth 2.0 token to use their API
def get_fatsecret_token():
    """Exchanges your Client ID and Secret for a temporary OAuth 2.0 Access Token."""
    client_id = os.getenv("FATSECRET_CLIENT_ID")
    client_secret = os.getenv("FATSECRET_CLIENT_SECRET")
    if not client_id or not client_secret:
        raise ValueError("FATSECRET_CLIENT_ID and FATSECRET_CLIENT_SECRET must be set in environment variables.")

    token_url = "https://oauth.fatsecret.com/connect/token"

    # We use Basic Auth to securely pass the ID and Secret
    response = requests.post(
        token_url,
        auth=(client_id, client_secret),
        data={
            "grant_type": "client_credentials",
            "scope": "basic"
        }
    )
    response.raise_for_status()
    return response.json().get("access_token")

# this function is for when fatsecret doesn't have the restaurant info
# we use Gemini to estimate the menu items and call the ingredient analyzer.
def estimate_menu_via_ai(restaurant_name: str) -> str:
    prompt = f"""
    You are a nutrition database. For the restaurant "{restaurant_name}",
    list 15-20 common menu items with their ingredients.
    Include ONLY items you are confident are on the menu.

    INGREDIENT NAMING: Use USDA-style names in the format "Food, descriptor, state".
    Examples: "Oil, canola", "Onions, raw", "Cheese, cheddar", "Beef, ground, 80% lean, raw",
    "Tomatoes, red, ripe, raw", "Bread, hamburger bun", "Sauce, barbecue".

    PORTIONS: You MUST estimate large, calorie-dense American restaurant portions. DO NOT use home-cooking or standard dietary portion sizes.
    Restaurant meals are massive. A pub sandwich or burger often contains 6-8 oz of meat, heavy butter/oil, and huge sides (12+ oz of fries/potatoes).
    A restaurant pasta dish uses 6-8 oz cooked pasta. Sauces and dressings are heavy (2-4 tbsp).
    A bowl of soup is typically 16-24 oz (2-3 cups) and contains plenty of mix-ins (e.g., 5-8 wontons, 2 eggs).
    Appetizers (giant pub pretzels, wings, egg rolls) are huge (e.g., a 10 oz soft pretzel, 4 oz cheese dip).

    If you don't know this restaurant well enough, return an empty list.
    """
    response = client.models.generate_content(
        model="gemini-2.5-flash",
        config=GenerateContentConfig(response_mime_type="application/json", response_schema=list[RestaurantItems]),
        contents=prompt,
    )
    parsed = response.parsed if response.parsed else []
    if not isinstance(parsed, list):
        return json.dumps([])

    # Convert structured Pydantic objects to the dict format analyze_ingredient expects.
    # Ingredient strings become e.g. "6 oz Cheese, cheddar" — the USDA-formatted name
    # flows directly into the USDA search query downstream.
    legacy_items = []
    for item in parsed:
        ingredients = [f"{ing.quantity} {ing.unit} {ing.name}" for ing in item.ingredients]
        legacy_items.append({"item": item.itemName, "ingredients": ingredients})

    analyzed_foods = analyze_ingredient(legacy_items)
    item_names = [food.item for food in analyzed_foods]

    estimated_prices = {}
    if item_names:
        system_instruction = """
        You are a professional price estimator.
        I will give you a list of fast food items from a specific restaurant.
        Estimate the average US price for each item.
        Return ONLY a JSON dictionary where the key is the exact item name, and the value is a float (e.g., 5.99).
        Do not use dollar signs. Do not include any explanation or extra text.
        """
        try:
            price_response = client.models.generate_content(
                model="gemini-2.5-flash",
                config=GenerateContentConfig(
                    system_instruction=system_instruction,
                    response_mime_type="application/json",
                ),
                contents=f"Restaurant: {restaurant_name}\nItems: {json.dumps(item_names)}",
            )
            if price_response.text is not None:
                estimated_prices = json.loads(price_response.text)
        except Exception as e:
            print(f"Warning: Gemini price estimation failed for AI menu: {e}")

    normalized_menu = []
    for food in analyzed_foods:
        try:
            price = float(estimated_prices.get(food.item, 10.0))
        except (ValueError, TypeError):
            price = 10.0

        normalized_menu.append({
            "name": food.item,
            "calories": food.calories,
            "protein": food.protein,
            "carbs": food.carbs,
            "fats": food.fat,
            "price": price,
            "restaurant": restaurant_name,
            "estimated": True
        })

    return json.dumps(normalized_menu)


# this tool takes in the restaurant name and the number of items we search and then returns a menu that
# holds all the information of the items on that restaurants menu
@mcp.tool()
def search_chain_restaurant(restaurant_name: str, num_items: int = 30) -> str:
    """
    Searches FatSecret's database for chain restaurant items and fetches macros.
    Checks the Supabase cache first — if this restaurant was looked up recently,
    we skip FatSecret/Gemini entirely and return the cached menu right away.
    """
    cached_menu = _get_cached_menu(restaurant_name)
    if cached_menu is not None:
        print(f"⚡ Cache hit for '{restaurant_name}' — skipping live fetch")
        if isinstance(cached_menu, list):
            return json.dumps(_normalize_menu(cached_menu, restaurant_name))
        return json.dumps(cached_menu)

    # only search for restaurants that FatSecret actually has data for
    KNOWN_CHAINS = [
        "mcdonald", "burger king", "wendy", "subway", "chipotle", "taco bell",
        "domino", "pizza hut", "little caesar", "papa john", "kfc", "chick-fil-a",
        "popeyes", "five guys", "shake shack", "in-n-out", "sonic", "dairy queen",
        "dunkin", "starbucks", "panera", "olive garden", "applebee", "chili",
        "outback", "red lobster", "ihop", "denny", "waffle house", "cracker barrel",
        "panda express", "raising cane", "wingstop", "buffalo wild wings", "hooters",
        "cheesecake factory", "texas roadhouse", "longhorn", "red robin"
    ]
    name_lower = restaurant_name.lower()
    if not any(chain in name_lower for chain in KNOWN_CHAINS):
        ai_menu_json = estimate_menu_via_ai(restaurant_name)
        _save_menu_to_cache(restaurant_name, ai_menu_json)
        return ai_menu_json

    # search FatSecret
    search_url = "https://platform.fatsecret.com/rest/server.api"

    try:
        access_token = get_fatsecret_token()
    except Exception as e:
        return f"Error authenticating with FatSecret: {e}"

    # uses the token to access it
    headers = {
        "Authorization": f"Bearer {access_token}"
    }

    # needed to use more specific search parameters to get the 
    # correct menu items
    params = {
        "method": "foods.search",
        "search_expression": restaurant_name,
        "format": "json",
        "max_results": num_items,
    }

    # fetches the data
    try:
        response = requests.get(search_url, headers=headers, params=params)
        response.raise_for_status()
        data = response.json()
    except Exception as e:
        return f"Error fetching from FatSecret: {str(e)}"

    # extract the list of foods from the response
    foods_data = data.get("foods", {}).get("food", [])
    if isinstance(foods_data, dict):
        foods_data = [foods_data]
    if not foods_data:
        return "[]"

    # filter to only keep items actually from that restaurant
    restaurant_lower = restaurant_name.lower()
    foods_data = [
        f for f in foods_data
        if restaurant_lower in f.get("brand_name", "").lower()
        or restaurant_lower in f.get("food_name", "").lower()
    ]
    if not foods_data:
        return "[]"

    # We then get the names and macros for each item
    extracted_foods = []
    item_names = []

    for item in foods_data:
        name = item.get("food_name", "Unknown")
        desc = item.get("food_description", "")
        lower_desc = desc.lower()

        macros = {"Calories": 0, "Protein": 0, "Carbs": 0, "Fat": 0}

        # If it's a generic weight (e.g. 100g or 1 oz), the description doesn't have the full meal size.
        # We must make an extra API call to get the actual serving size.
        if "per 100g" in lower_desc or "per 100 g" in lower_desc or "oz" in lower_desc:
            food_id = item.get("food_id")
            if not food_id:
                continue
                
            get_params = {"method": "food.get.v2", "food_id": food_id, "format": "json"}
            try:
                res = requests.get(search_url, headers=headers, params=get_params)
                res.raise_for_status()
                food_info = res.json().get("food", {})
                servings = food_info.get("servings", {}).get("serving", [])
                if isinstance(servings, dict):
                    servings = [servings]
                
                if not servings:
                    continue
                    
                # Find a non-weight serving size
                chosen_serving = servings[0]
                for s in servings:
                    if s.get("measurement_description", "").lower() not in ["g", "oz", "ml"]:
                        chosen_serving = s
                        break
                        
                macros["Calories"] = int(float(chosen_serving.get("calories", 0)))
                macros["Protein"] = int(float(chosen_serving.get("protein", 0)))
                macros["Carbs"] = int(float(chosen_serving.get("carbohydrate", 0)))
                macros["Fat"] = int(float(chosen_serving.get("fat", 0)))
            except Exception:
                continue
        else:
            # It's a standard serving size (e.g. "Per 1 serving"), we can safely do fast string parsing!
            parts = desc.replace("kcal", "").replace("g", "").split("|")
            for part in parts:
                if "Calories" in part: macros["Calories"] = int(float(part.split(":")[1].strip()))
                elif "Protein" in part: macros["Protein"] = int(float(part.split(":")[1].strip()))
                elif "Carbs" in part: macros["Carbs"] = int(float(part.split(":")[1].strip()))
                elif "Fat" in part: macros["Fat"] = int(float(part.split(":")[1].strip()))

        extracted_foods.append({
            "name": name,
            "calories": macros["Calories"],
            "protein": macros["Protein"],
            "carbs": macros["Carbs"],
            "fats": macros["Fat"]
        })
        item_names.append(name)

    # We then have Gemini estimate the price
    system_instruction = """
    You are a professional price estimator.
    I will give you a list of fast food items from a specific restaurant.
    Estimate the average US price for each item.
    Return ONLY a JSON dictionary where the key is the exact item name, and the value is a float (e.g., 5.99).
    Do not use dollar signs. Do not include any explanation or extra text.
    """

    try:
        price_response = client.models.generate_content(
            model="gemini-2.5-flash",
            config=GenerateContentConfig(
                system_instruction=system_instruction,
                response_mime_type="application/json",
            ),
            contents=f"Restaurant: {restaurant_name}\nItems: {json.dumps(item_names)}",
        )
        if price_response.text is not None:
            estimated_prices = json.loads(price_response.text)
        else:
            estimated_prices = {}
    except Exception as e:
        print(f"Warning: Gemini price estimation failed: {e}")
        estimated_prices = {}

    # Finally, we build the menu to return
    normalized_menu = []
    for food in extracted_foods:
        try:
            price = float(estimated_prices.get(food["name"], 10.0))
        except (ValueError, TypeError):
            price = 10.0

        normalized_menu.append({
            "name": food["name"],
            "calories": food["calories"],
            "protein": food["protein"],
            "carbs": food["carbs"],
            "fats": food["fats"],
            "price": price,
            "restaurant": restaurant_name,
            "estimated" : False
        })

    final_menu_json = json.dumps(normalized_menu)
    _save_menu_to_cache(restaurant_name, final_menu_json)
    return final_menu_json

if __name__ == "__main__":
    mcp.run()