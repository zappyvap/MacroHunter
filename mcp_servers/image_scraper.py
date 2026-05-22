import os
import io
import json
from dotenv import load_dotenv
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from google import genai
from PIL import Image

load_dotenv()

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # lock down in production
    allow_methods=["*"],
    allow_headers=["*"],
)

"""
Using a FastAPI server instead of MCP for this case because the MCP would need a cached
version of the image to work with and that adds unnecessary complexity. This endpoint is just for
taking in an image, sending it to Gemini for translation, and then returning the JSON result.
"""
@app.post("/translate-menu")
async def translate_menu(file: UploadFile = File(...)):
    """
    Accepts an image of a restaurant menu and uses Gemini's vision capabilities
    to translate the menu into a JSON array, estimating macros and calories if needed.
    """
    contents = await file.read()
    image = Image.open(io.BytesIO(contents))

    prompt = """
    This is a restaurant menu. Extract every item and return ONLY a JSON array,
    no markdown, no explanation, just raw JSON.

    Use this exact format:
    [
      {
        "name": "Food Item Name",
        "protein": grams of protein,
        "carbs": grams of carbs,
        "fats": grams of fats,
        "calories": total calories,
        "price": cost of the item
     }
    ]

    If a field isn't visible, estimate based on information provided in the image.
    """

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=[image, prompt],
        config={"temperature": 0.1}
    )

    text = response.text.strip().removeprefix("```json").removesuffix("```").strip()
    return json.loads(text)