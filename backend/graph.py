from typing import TypedDict, Annotated
from langgraph.graph import StateGraph, START, END
from dotenv import load_dotenv
import sys
import os
import requests
from operator import add
import json

current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
sys.path.append(parent_dir)

# ── Correct imports: pull the function AND its models directly ────────────────
# image_scraper is a FastAPI HTTP server — no import needed, called via requests
from mcp_servers.restaurant_finder import restaurant_finder, LocationDetails
from mcp_servers.calorie_optimizer import optimizer as calorie_optimizer
from mcp_servers.chain_reader import search_chain_restaurant as chain_reader
from mcp_servers.judge import rank as judge

load_dotenv()

"""
The general workflow of the app is as follows:
1. User inputs either a search request or an image of a menu.
2. If they input a search request, we search for the restaurants around them and get the menu items.
3. If they input an image, we use Gemini's vision capabilities to translate the menu into text.
4. We then take the menu items and optimize them for calories based on user preferences.
5. Finally, we return the optimized menu to the user.
"""

# this is basically just the universal scope for all the nodes to update and read data from
class State(TypedDict):
    restaurant_list: list[str] | None
    current_restaurant: str | None
    current_restaurant_index: int | None
    menu_items: list[str] | None
    image_url: str | None
    searching_for_restaurant: bool
    lat: float | None
    lon: float | None
    best_orders: Annotated[list[str], add]
    target_calories: float
    target_protein: float
    target_carbs: float
    target_fats: float
    final_orders: list[str] | None

graph_builder = StateGraph(State) # makes the graph

# define all the nodes needed

# this node finds nearby restaurants based on user location
def find_restaurants(state: State):
    print("📍 Routing: Finding nearby restaurants...")
    result = restaurant_finder(LocationDetails(
        lat=state["lat"],
        lon=state["lon"],
        radius=5.0
    ))
    return {"restaurant_list": result}

# this node gets the menu items for a specific restaurant from our database
# it uses the current_restaurant_index to know which restaurant to pull from the list and
# then updates the menu items and current restaurant in the state
def get_menu_items(state: State):
    print("🍔 Routing: Pulling database menus...")
    index = state.get("current_restaurant_index", 0)
    current = state["restaurant_list"][index]
    result = chain_reader(current["name"])
    result = json.loads(result) if isinstance(result, str) else result
    return {"menu_items": result, "current_restaurant": current}

# this is when the user uploads a picture instead of searching for restaurants
def image_translation(state: State):
    """
    Expects state["image_url"] to be a URL pointing to a menu image.
    Downloads the image, sends it to the image scraper service,
    and stores the parsed menu items in state["menu_items"].
    """
    photo_url = state.get("image_url")
    if not photo_url:
        return {"menu_items": []}

    # Download the image
    image_response = requests.get(photo_url)
    image_bytes = image_response.content

    # Send to your image scraper FastAPI server (run separately on port 8001)
    # start it with: uvicorn mcp_servers.image_scraper:app --port 8001
    response = requests.post(
        "http://127.0.0.1:8001/translate-menu",
        files={"file": ("menu.jpg", image_bytes, "image/jpeg")}
    )
    return {"menu_items": response.json()}

# this is the calorie optimization node that uses linear programming to find the best
# combination of menu items based on user macro targets.
# It then updates the best orders in the state and increments the restaurant index to
# move to the next restaurant if needed.
def optimize_calories(state: State):
    print("🧮 Routing: Running PuLP Math Engine...")
    if not state.get("menu_items"):
        return {
            "best_orders": [],
            "current_restaurant_index": state.get("current_restaurant_index", 0) + 1
        }
    result = calorie_optimizer(
        state["menu_items"],
        state["target_calories"],
        state["target_protein"],
        state["target_carbs"],
        state["target_fats"]
    )
    return {
        "best_orders": [{
            **result,
            "restaurant": state.get("current_restaurant", "Unknown")  # ← full object
        }],
        "current_restaurant_index": state.get("current_restaurant_index", 0) + 1
    }

# finally the judge node takes all the best orders from all the restaurants and puts them against each other
# to see the best overall meals. It then returns the same orders but sorted by the best to worst.
def judge_node(state: State):
    print("⚖️  Routing: Judging best meals...")
    result = judge(
        state["best_orders"]
    )
    return {"final_orders": result}

# add all the nodes to the graph
# first parameter is name of node and second is the function that runs at that node.
graph_builder.add_node("find_restaurants", find_restaurants)
graph_builder.add_node("get_menus", get_menu_items)
graph_builder.add_node("image_translation", image_translation)
graph_builder.add_node("optimizer", optimize_calories)
graph_builder.add_node("judge", judge_node)

# add router for conditional path
def route_user_input(state: State):
    # If the boolean is True, go to the API path. If False, go to the Vision path.
    if state.get("searching_for_restaurant") is True:
        return "find_restaurants"
    else:
        return "image_translation"

def route_after_optimizer(state: State):
    current_restaurant_index = state.get("current_restaurant_index", 0)
    if current_restaurant_index < len(state.get("restaurant_list") or []):
        return "get_menus"
    return "judge"

# conditional edge to change workflow based on user input
graph_builder.add_conditional_edges(
    START,
    route_user_input
)
graph_builder.add_conditional_edges(
    "optimizer",
    route_after_optimizer
)
# The API Path
graph_builder.add_edge("find_restaurants", "get_menus")
graph_builder.add_edge("get_menus", "optimizer")

# The Vision Path
graph_builder.add_edge("image_translation", "optimizer")

graph_builder.add_edge("judge", END)

graph = graph_builder.compile()