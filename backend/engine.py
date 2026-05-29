from fastapi import FastAPI
from pydantic import BaseModel
# import the langgraph agent from the other file
from graph import graph 
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# define input from user
class UserRequest(BaseModel):
    searching_for_restaurant: bool
    latitude: float | None = None
    longitude: float | None = None
    target_calories: float
    target_protein: float
    target_carbs: float
    target_fats: float


@app.post("/api/optimize-meal")
def run_macro_hunter(request: UserRequest):
    
    # format frontend data
    initial_state = {
        "searching_for_restaurant": request.searching_for_restaurant,
        "lat" : request.latitude,
        "lon" : request.longitude,
        "target_calories": request.target_calories,
        "target_protein": request.target_protein,
        "target_carbs": request.target_carbs,
        "target_fats": request.target_fats,
        "current_restaurant_index": 0
    }
    
    # run graph agent
    final_state = graph.invoke(initial_state)
    print("final_state keys:", final_state.keys())
    print("final_orders:", final_state.get("final_orders"))
    print("best_orders:", final_state.get("best_orders"))
    # return optimized meal plan to frontend
    return {
        "status": "success",
        "results": final_state["final_orders"] 
    }