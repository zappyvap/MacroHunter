from typing import TypedDict
from langgraph.graph import StateGraph, START, END
from dotenv import load_dotenv
import sys
import os
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
sys.path.append(parent_dir)

from mcp_servers import restaurant_finder
from mcp_servers import image_scraper
from mcp_servers import calorie_optimizer
from mcp_servers import chain_reader
from mcp_servers import judge

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
    menu_items: list[str] | None
    image_url : str | None
    searching_for_restaurant: bool
    lat : float | None
    lon : float | None
    best_orders: list[str] | None

graph_builder = StateGraph(State) # makes the graph

# define all the nodes needed
def find_restaurants(state : State):
    # Placeholder for actual restaurant search logic
    print("📍 Routing: Finding nearby restaurants...")
    return {"restaurant_list": ["Chipotle", "Burger King"]} 

def get_menu_items(state : State):
    # Placeholder for actual menu item retrieval logic
    print("🍔 Routing: Pulling database menus...")
    return {"menu_items": ["Item 1", "Item 2"]}

def image_translation(state : State):
    # Placeholder for actual image translation logic
    print("📸 Routing: Using Gemini Vision on local menu...")
    return {"menu_items": ["Scanned Item 1", "Scanned Item 2"]} 

def optimize_calories(state : State):
    # Placeholder for actual calorie optimization logic
    print("🧮 Routing: Running PuLP Math Engine...")
    return {"current_restaurant": "Optimization Complete"} 

def judge_node(state : State):
    pass

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

# conditional edge to change workflow based on user input
graph_builder.add_conditional_edges(
    START, 
    route_user_input
)

# The API Path
graph_builder.add_edge("find_restaurants", "get_menus")
graph_builder.add_edge("get_menus", "optimizer")

# The Vision Path
graph_builder.add_edge("image_translation", "optimizer")

graph_builder.add_edge("optimizer", "judge") 
graph_builder.add_edge("judge", END)

graph = graph_builder.compile()

# --- QUICK TEST RUN ---
if __name__ == "__main__":
    print("\n--- TEST 1: The Chain Database Route ---")
    test_state_1 = {"searching_for_restaurant": True}
    graph.invoke(test_state_1)

    print("\n--- TEST 2: The Local Vision Route ---")
    test_state_2 = {"searching_for_restaurant": False, "image_url": "menu.jpg"}
    graph.invoke(test_state_2)