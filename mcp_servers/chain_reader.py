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

# this tool takes in the restaurant name and the number of items we search and then returns a menu that
# holds all the information of the items on that restaurants menu
@mcp.tool()
def search_chain_restaurant(restaurant_name: str, num_items: int = 30) -> str:
    """
    Searches FatSecret's database for chain restaurant items and fetches macros.
    """
    try:
        access_token = get_fatsecret_token()
    except Exception as e:
        return f"Error authenticating with FatSecret: {e}"

    # --- Step 1: Search the FatSecret Database ---
    search_url = "https://platform.fatsecret.com/rest/server.api"
    
    headers = {
        "Authorization": f"Bearer {access_token}"
    }
    
    params = {
        "method": "foods.search",
        "search_expression": restaurant_name,
        "format": "json",
        "max_results": num_items
    }

    try:
        response = requests.get(search_url, headers=headers, params=params)
        response.raise_for_status()
        data = response.json()
    except Exception as e:
        return f"Error fetching from FatSecret: {str(e)}"

    # FatSecret's JSON structure puts results inside foods -> food
    foods_data = data.get("foods", {}).get("food", [])
    if not foods_data:
        return "[]"
        
    # If there's only one result, FatSecret returns a dict instead of a list
    if isinstance(foods_data, dict):
        foods_data = [foods_data]

    # --- Step 2: Extract Data and Prepare for Gemini ---
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

    # --- Step 3: Batch-estimate prices with one Gemini call ---
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
            "restaurant": restaurant_name
        })

    return json.dumps(normalized_menu)

if __name__ == "__main__":
    mcp.run()