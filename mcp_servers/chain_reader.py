import os
import requests
import json
import dotenv
from datetime import datetime, timezone, timedelta
from mcp.server.fastmcp import FastMCP
from google import genai
from google.genai.types import GenerateContentConfig
from mcp_servers.supabase_client import supabase

dotenv.load_dotenv()
client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
mcp = FastMCP("Chain Restaurant Menu Search Tool")

# ─── Supabase menu cache ──────────────────────────────────────────────────
# Fetching a restaurant's menu is the slow part of a search: it's either a
# FatSecret API call + a Gemini price-estimation call, or a full Gemini
# menu-estimation call. The same restaurants come up over and over for
# people searching nearby, so we cache the finished menu in Supabase and
# skip straight past FatSecret/Gemini on repeat lookups.

CACHE_TABLE = "menu_cache"
CACHE_MAX_AGE_DAYS = 30  # after this long we re-fetch, in case prices/menus changed

def _cache_key(restaurant_name: str) -> str:
    """Normalize the name so 'Applebee's' and 'applebee's' hit the same row."""
    return restaurant_name.strip().lower()

def _get_cached_menu(restaurant_name: str):
    """Returns the cached menu (a list) if we have a fresh one, otherwise None."""
    try:
        key = _cache_key(restaurant_name)
        result = supabase.table(CACHE_TABLE).select("*").eq("restaurant_name", key).execute()

        if not result.data:
            return None

        row = result.data[0]
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
# we use Gemini to estimate the menu.
def estimate_menu_via_ai(restaurant_name: str) -> str:
    prompt = f"""
    You are a nutrition database. For the restaurant "{restaurant_name}", 
    list 15-20 common menu items with estimated macros.
    
    Only include items if you have reasonable confidence in the macros.
    Return ONLY a JSON array:
    [{{
        "name": "Item Name",
        "calories": int,
        "protein": int,
        "carbs": int,
        "fats": int,
        "price": float,
        "restaurant": "{restaurant_name}",
        "estimated": true
    }}]
    If you don't know this restaurant well enough, return [].
    """
    response = client.models.generate_content(
        model="gemini-2.5-flash",
        config=GenerateContentConfig(response_mime_type="application/json"),
        contents=prompt,
    )
    return response.text

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
        print("RAW FATSECRET RESPONSE:", json.dumps(data, indent=2))
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
        # FatSecret returns macros as a single string description we need to parse
        # Example: "Per 100g - Calories: 250kcal | Fat: 10.00g | Carbs: 30.00g | Protein: 15.00g"
        desc = item.get("food_description", "")

        # Simple extraction logic to pull out the raw numbers
        macros = {"Calories": 0, "Protein": 0, "Carbs": 0, "Fat": 0}
        parts = desc.replace("kcal", "").replace("g", "").split("|")
        for part in parts:
            if "Calories" in part: macros["Calories"] = float(part.split(":")[1].strip())
            elif "Protein" in part: macros["Protein"] = float(part.split(":")[1].strip())
            elif "Carbs" in part: macros["Carbs"] = float(part.split(":")[1].strip())
            elif "Fat" in part: macros["Fat"] = float(part.split(":")[1].strip())

        extracted_foods.append({
            "name": name,
            "calories": int(macros["Calories"]),
            "protein": int(macros["Protein"]),
            "carbs": int(macros["Carbs"]),
            "fats": int(macros["Fat"])
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
        estimated_prices = json.loads(price_response.text)
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