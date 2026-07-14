from typing import TypedDict, Annotated
from langgraph.graph import StateGraph, START, END
from langgraph.types import Send
from dotenv import load_dotenv
import sys
import os
import requests
from operator import add
import json
import base64

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

# this is basically just the universal scope for all the nodes to update and read data from.
# note: menu_items and current_restaurant are no longer written to shared state in the
# parallel path — each branch keeps them as local variables inside fetch_and_optimize
# to avoid the InvalidUpdateError that occurs when multiple branches write to the
# same plain (non-reducer) key in the same step.
class State(TypedDict):
    restaurant_list: list[str] | None
    current_restaurant_index: int | None  # used by Send() to tell each branch which restaurant to handle
    menu_items: list[str] | None          # only used by the vision path (single branch)
    searching_for_restaurant: bool
    lat: float | None
    lon: float | None
    best_orders: Annotated[list[str], add]  # add reducer safely merges writes from all parallel branches
    target_calories: float
    target_protein: float
    target_carbs: float
    target_fats: float
    final_orders: list[str] | None
    image_b64: str | None  # base64 representation of the uploaded file

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

# this node combines menu fetching and calorie optimization into a single step
# for the parallel path. previously these were two separate nodes (get_menus and
# optimizer) connected by an edge, but splitting them caused an InvalidUpdateError
# because all parallel branches tried to write menu_items and current_restaurant
# to shared state simultaneously. by merging them here, each branch keeps its
# menu data as a local variable and only writes to best_orders at the end,
# which is safe because best_orders uses the Annotated[list, add] reducer.
def fetch_and_optimize(state: State):
    print("🍔 Routing: Pulling database menus...")
    index = state.get("current_restaurant_index", 0)
    current = state["restaurant_list"][index]

    # get the menu items for this specific restaurant
    result = chain_reader(current["name"])
    print("=" * 40)
    print("RAW RESULT:", repr(result))
    print("=" * 40)
    menu_items = json.loads(result) if isinstance(result, str) else result

    if not menu_items:
        return {"best_orders": []}

    # this is the calorie optimization node that uses linear programming to find the best
    # combination of menu items based on user macro targets.
    # each parallel branch runs this independently on its own restaurant's menu.
    print("🧮 Routing: Running PuLP Math Engine...")
    result = calorie_optimizer(
        menu_items,
        state["target_calories"],
        state["target_protein"],
        state["target_carbs"],
        state["target_fats"]
    )

    # only write to best_orders — the add reducer merges all parallel branch results
    # by concatenation once every branch finishes, before judge runs.
    return {
        "best_orders": [{
            **result,
            "restaurant": current  # ← full object
        }]
    }

# this is when the user uploads a picture instead of searching for restaurants
def image_translation(state: State):
    """
    Expects state["image_b64"] to be a Base64-encoded image string.
    Decodes the image and sends it to the image scraper service,
    storing the parsed menu items in state["menu_items"].
    """
    image_b64 = state.get("image_b64")
    if not image_b64:
        return {"menu_items": []}

    image_bytes = base64.b64decode(image_b64)

    import socket
    host = "127.0.0.1"
    try:
        socket.gethostbyname("scanner")
        host = "scanner"
    except socket.gaierror:
        pass

    response = requests.post(
        f"http://{host}:8001/translate-menu",
        files={"file": ("menu.jpg", image_bytes, "image/jpeg")}
    )
    return {"menu_items": response.json()}

# this is the calorie optimization node for the vision path only.
# the parallel restaurant path uses fetch_and_optimize instead.
def optimize_calories(state: State):
    print("🧮 Routing: Running PuLP Math Engine...")
    print("DEBUG - Targets:", {
        "calories": state.get("target_calories"),
        "protein": state.get("target_protein"),
        "carbs": state.get("target_carbs"),
        "fats": state.get("target_fats")
    })
    print("DEBUG - Menu Items Count:", len(state.get("menu_items") or []))
    if not state.get("menu_items"):
        return {"best_orders": []}
    
    current_menu = list(state["menu_items"])
    best_orders = []
    
    for i in range(3):
        if not current_menu:
            break
        result = calorie_optimizer(
            current_menu,
            state["target_calories"],
            state["target_protein"],
            state["target_carbs"],
            state["target_fats"]
        )
        print(f"DEBUG - Run {i+1} Result:", result)
        if not result or not result.get("order"):
            break
            
        best_orders.append({
            **result,
            "restaurant": f"Uploaded Menu (Option {i + 1})"
        })
        
        # Remove the items returned in this order from the menu for the next iteration
        used_items = {o["item"] for o in result["order"]}
        current_menu = [item for item in current_menu if item["name"] not in used_items]
        
    return {"best_orders": best_orders}

# finally the judge node takes all the best orders from all the restaurants and puts them against each other
# to see the best overall meals. It then returns the same orders but sorted by the best to worst.
# because all parallel branches feed into best_orders before judge runs, this node
# always receives the full set of results regardless of how many restaurants were found.
def judge_node(state: State):
    print("⚖️  Routing: Judging best meals...")
    result = judge(
        state["best_orders"]
    )
    return {"final_orders": result}

# add all the nodes to the graph
# first parameter is name of node and second is the function that runs at that node.
graph_builder.add_node("find_restaurants", find_restaurants)
graph_builder.add_node("fetch_and_optimize", fetch_and_optimize)
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

# fan-out function: after find_restaurants completes and we have the full restaurant list,
# spawn one independent fetch_and_optimize execution per restaurant using Send().
# each Send passes its own current_restaurant_index so branches don't interfere with
# each other. LangGraph fires all of them simultaneously instead of looping one at a time.
def fan_out_restaurants(state: State):
    return [
        Send("fetch_and_optimize", {
            **state,
            "current_restaurant_index": i
        })
        for i in range(len(state.get("restaurant_list") or []))
    ]

# conditional edge to change workflow based on user input
graph_builder.add_conditional_edges(
    START,
    route_user_input
)

# The API Path — fan out all restaurants in parallel instead of looping sequentially.
# each branch runs fetch_and_optimize independently and writes only to best_orders.
graph_builder.add_conditional_edges("find_restaurants", fan_out_restaurants)

# all parallel fetch_and_optimize branches write into best_orders via the add reducer,
# then LangGraph waits for every branch to finish before moving on to judge.
graph_builder.add_edge("fetch_and_optimize", "judge")

# The Vision Path — still sequential since there's only one menu to process
graph_builder.add_edge("image_translation", "optimizer")
graph_builder.add_edge("optimizer", "judge")

graph_builder.add_edge("judge", END)

graph = graph_builder.compile()