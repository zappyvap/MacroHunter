from typing import TypedDict, Annotated
from langgraph.graph import StateGraph, START, END
from dotenv import load_dotenv

load_dotenv()

# this is basically just the universal scope for all the nodes to update and read data from
class State(TypedDict):
    restaurant_list: list[str] | None
    current_restaurant: str | None
    menu_items: list[str] | None
    image_url : str | None
    searching_for_restaurant: bool



graph_builder = StateGraph(State) # makes the graph

# define all the nodes needed
def find_restaurants(state : State) -> list[str]:
    # Placeholder for actual restaurant search logic
    pass

def get_menu_items(state : State) -> list[str]:
    # Placeholder for actual menu item retrieval logic
    pass

def image_translation(state : State) -> str:
    # Placeholder for actual image translation logic
    pass 

def optimize_calories(state : State) -> str:
    # Placeholder for actual calorie optimization logic
    pass 

# add all the nodes to the graph
# first parameter is name of node and second is the function that runs at that node.
graph_builder.add_node(START, find_restaurants)
graph_builder.add_node("get menus", get_menu_items)
graph_builder.add_node("image_translation", image_translation)
graph_builder.add_node("optimizer", optimize_calories)

# conditional edge to change workflow based on user input
graph_builder.add_conditional_edges(
    START, 
    lambda state: state.get["searching_for_restaurant"],
    {"True": "get menus", "False": "image_translation"}
)
graph_builder.add_edge("get menus", "optimizer")
graph_builder.add_edge("image_translation", "optimizer")
graph_builder.add_edge("optimizer", END) 

graph = graph_builder.compile()

