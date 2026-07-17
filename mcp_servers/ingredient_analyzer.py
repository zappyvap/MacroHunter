import os
from pydantic import BaseModel
from usda_fdc import FdcClient
from dotenv import load_dotenv

load_dotenv()

USDA_KEY = os.getenv("USDA_API_KEY")
client = FdcClient(api_key=USDA_KEY)


class FoodItem(BaseModel):
    item: str
    calories: float
    protein: float
    carbs: float
    fat: float


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

        # Search USDA FDC for the food item by name
        query = food_item.get("ingredients") or food_item.get("item", "")
        results = client.search(query, page_size=1)

        if results and results.foods:
            top_result = results.foods[0]
            fdc_id = top_result.fdc_id

            # Get full nutrient details for the food
            food_detail = client.get_food(fdc_id)
            nutrients = food_detail.food_nutrients if hasattr(food_detail, "food_nutrients") else []

            # Loop through and match against official USDA nutrient names
            # All values are per 100g by default from the API
            for n in nutrients:
                name = (n.nutrient.name if hasattr(n, "nutrient") else getattr(n, "name", "")).lower()
                unit = (n.nutrient.unit_name if hasattr(n, "nutrient") else getattr(n, "unit_name", "")).lower()
                amount = getattr(n, "amount", 0) or 0

                if "energy" in name and unit == "kcal":
                    calories += amount
                elif name == "protein":
                    protein += amount
                elif "carbohydrate, by difference" in name:
                    carbs += amount
                elif "total lipid (fat)" in name:
                    fat += amount

        food_list.append(
            FoodItem(
                item=food_item["item"],
                calories=round(calories, 1),
                protein=round(protein, 1),
                carbs=round(carbs, 1),
                fat=round(fat, 1),
            )
        )

    return food_list


if __name__ == "__main__":
    test_items = [
        {
            "item": "Cheeseburger",
            "ingredients": "Beef patty, bun, cheese, lettuce, tomato, ketchup, mustard"
        }
    ]
    results = analyze_ingredient(test_items)
    for r in results:
        print(r)