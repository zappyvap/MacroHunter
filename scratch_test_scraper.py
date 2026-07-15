import os
from dotenv import load_dotenv
from google import genai
from PIL import Image

load_dotenv()
client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
image = Image.open("applebees-menu-with-prices-scaled.webp")

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

print(response.text)
