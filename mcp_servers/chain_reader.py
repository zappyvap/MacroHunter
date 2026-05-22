import os
import requests
import json
import dotenv
from mcp.server.fastmcp import FastMCP
from google import genai
from google.genai.types import GenerateContentConfig

dotenv.load_dotenv()
client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
mcp = FastMCP("Chain Restaurant Menu Search Tool")


def get_macro(nutrients: list, macro_name: str) -> int:
    """Extract and clean a macro value from a nutrients list."""
    for n in nutrients:
        if n.get("name", "").lower() == macro_name.lower():
            value = n.get("amount", 0)
            if not value:
                return 0
            if isinstance(value, (int, float)):
                return int(value)
            return int(float(str(value).replace("g", "").strip() or 0))
    return 0


@mcp.tool()
def search_chain_restaurant(restaurant_name: str, num_items: int = 6) -> str:
    """
    Searches the Spoonacular database for menu items from a chain restaurant,
    fetches full nutrition data for each item, and uses Gemini to batch-estimate prices.

    Args:
        restaurant_name: The name of the chain restaurant to search (e.g. "McDonald's").
        num_items: How many menu items to return. Defaults to 6 to stay within free tier limits.
    """
    api_key = os.getenv("SPOONACULAR_API_KEY")
    if not api_key:
        return "Error: Missing SPOONACULAR_API_KEY."

    # --- Step 1: Search for menu items ---
    search_url = "https://api.spoonacular.com/food/menuItems/search"
    search_params = {
        "query": restaurant_name,
        "apiKey": api_key,
        "number": num_items,
    }

    try:
        search_response = requests.get(search_url, params=search_params)
        search_response.raise_for_status()
        search_data = search_response.json()
    except Exception as e:
        return f"Error fetching search results from Spoonacular: {str(e)}"

    if "menuItems" not in search_data or not search_data["menuItems"]:
        return "[]"

    # --- Step 2: Fetch full nutrition data for each item individually ---
    detailed_items = []
    for item in search_data["menuItems"]:
        item_id = item.get("id")
        if not item_id:
            continue
        detail_url = f"https://api.spoonacular.com/food/menuItems/{item_id}"
        try:
            detail_response = requests.get(detail_url, params={"apiKey": api_key})
            detail_response.raise_for_status()
            detailed_items.append(detail_response.json())
        except Exception as e:
            # If a single item fails, skip it rather than failing the whole request
            print(f"Warning: Could not fetch details for item {item_id}: {e}")
            continue

    if not detailed_items:
        return "[]"

    # --- Step 3: Batch-estimate prices with one Gemini call ---
    item_names = [item.get("title", "Unknown") for item in detailed_items]

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

    # --- Step 4: Build the normalized menu ---
    normalized_menu = []

    for item in detailed_items:
        item_name = item.get("title", "Unknown Item")
        nutrients = item.get("nutrition", {}).get("nutrients", [])

        try:
            item_price = float(estimated_prices.get(item_name, 10.0))
        except (ValueError, TypeError):
            item_price = 10.0

        normalized_item = {
            "name": item_name,
            "calories": get_macro(nutrients, "Calories"),
            "protein": get_macro(nutrients, "Protein"),
            "carbs": get_macro(nutrients, "Carbohydrates"),
            "fats": get_macro(nutrients, "Fat"),
            "price": item_price,
        }
        normalized_menu.append(normalized_item)

    return json.dumps(normalized_menu)


if __name__ == "__main__":
    mcp.run()