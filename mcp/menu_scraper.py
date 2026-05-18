import types
from mcp.server.fastmcp import FastMCP
import requests
from bs4 import BeautifulSoup
import json
from google import genai
import os
import dotenv

# this makes the mcp server
dotenv.load_dotenv();
mcp = FastMCP("Local Menu Scraper")
client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

@mcp.tool()
async def scrape_local_menu(url: str) -> str:
    """
    Scrapes a local restaurant's website, extracts the menu items, 
    and estimates the macros for the linear programming optimizer.
    :param url: The URL of the restaurant's menu page.
    :return: A JSON string containing the menu items and their estimated macros.
    """
    # this scrapes the website and gets the raw HTML
    headers = {'User-Agent': 'Mozilla/5.0'}
    response = requests.get(url, headers=headers)
    soup = BeautifulSoup(response.text, 'html.parser')
    raw_text = soup.get_text(separator=' ', strip=True)
    
    # system instruction for the LLM
    system_instruction = "You are a professional HTML parser. Extract data into valid JSON only."

    # send HTML with a specific extraction request
    response = client.models.generate_content(
    model="gemini-1.5-flash",
    config=types.GenerateContentConfig(
        system_instruction=system_instruction,
        response_mime_type="application/json" # Forces JSON output
    ),
    contents=f"Extract the food items along with the description and the calories, protein, carbs, and fats from this HTML: {raw_text}"
    )
    
    estimated_menu = response.text

    # MCP tools must return strings, so we dump the JSON
    return json.dumps(estimated_menu)

if __name__ == "__main__":
    # This runs the server so LangGraph can connect to it
    mcp.run()