import os
import io
import json
from dotenv import load_dotenv
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from google import genai
from PIL import Image
from pydantic import BaseModel, Field
from typing import Literal

load_dotenv()

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # lock down in production
    allow_methods=["*"],
    allow_headers=["*"],
)

class Ingredient(BaseModel):
    name: str = Field(description="USDA-style food name: 'Food, descriptor, state'. Examples: 'Oil, canola', 'Onions, raw', 'Cheese, cheddar', 'Beef, ground, 80% lean, raw'. No quantities or preparation notes.")
    quantity: float = Field(description="Numeric amount")
    unit: Literal["oz", "g", "lb", "cup", "tbsp", "tsp", "slice", "piece", "ml"]

class RestaurantItems(BaseModel):
    itemName: str
    price: float = Field(description="The price of the item on the menu. Do not include the currency symbol. E.g. 12.99", default=10.0)
    ingredients: list[Ingredient]

"""
Using a FastAPI server instead of MCP for this case because the MCP would need a cached
version of the image to work with and that adds unnecessary complexity. This endpoint is just for
taking in an image, sending it to Gemini for translation, and then returning the JSON result.
"""
from ingredient_analyzer import analyze_ingredient

@app.post("/translate-menu")
async def translate_menu(file: UploadFile = File(...)):
    """
    Accepts an image of a restaurant menu and uses Gemini's vision capabilities
    to translate the menu into a JSON array, estimating macros and calories if needed.
    """
    contents = await file.read()
    image = Image.open(io.BytesIO(contents))

    prompt = """
    This is a restaurant menu. Extract every item and list its raw ingredients.
    Include ONLY items you are confident are on the menu.

    INGREDIENT NAMING: Use USDA-style names in the format "Food, descriptor, state".
    Examples: "Oil, canola", "Onions, raw", "Cheese, cheddar", "Beef, ground, 80% lean, raw",
    "Tomatoes, red, ripe, raw", "Bread, hamburger bun", "Sauce, barbecue".

    PORTIONS: You MUST estimate large, calorie-dense American restaurant portions. DO NOT use home-cooking or standard dietary portion sizes.
    Restaurant meals are massive. A pub sandwich or burger often contains 6-8 oz of meat, heavy butter/oil, and huge sides (12+ oz of fries/potatoes).
    A restaurant pasta dish uses 6-8 oz cooked pasta. Sauces and dressings are heavy (2-4 tbsp).
    A bowl of soup is typically 16-24 oz (2-3 cups) and contains plenty of mix-ins (e.g., 5-8 wontons, 2 eggs).
    Appetizers (giant pub pretzels, wings, egg rolls) are huge (e.g., a 10 oz soft pretzel, 4 oz cheese dip).
    """

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=[image, prompt],
        config={"temperature": 0.1, "response_mime_type": "application/json", "response_schema": list[RestaurantItems]}
    )

    parsed = response.parsed if response.parsed else []
    if not isinstance(parsed, list):
        return []

    # Convert to legacy dict format for analyze_ingredient
    legacy_items = []
    for item in parsed:
        ingredients = [f"{ing.quantity} {ing.unit} {ing.name}" for ing in item.ingredients]
        legacy_items.append({"item": item.itemName, "ingredients": ingredients})

    # Run through the math engine
    analyzed_foods = analyze_ingredient(legacy_items)
    
    # Format for the frontend
    results = []
    
    # maps each item name back to the price Gemini extracted from the menu image,
    # so we can attach the correct price to each analyzed food item
    price_map = {item.itemName: item.price for item in parsed}
    
    for food in analyzed_foods:
        results.append({
            "name": food.item,
            "calories": food.calories,
            "protein": food.protein,
            "carbs": food.carbs,
            "fats": food.fat,
            "price": price_map.get(food.item, 10.00)
        })
        
    return results