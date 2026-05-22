from fastapi import FastAPI
from pydantic import BaseModel
# import the langgraph agent from the other file
from graph import graph 

app = FastAPI()

# define input from user
class UserRequest(BaseModel):
    searching_for_restaurant: bool
    latitude: float | None = None
    longitude: float | None = None


@app.post("/api/optimize-meal")
def run_macro_hunter(request: UserRequest):
    
    # format frontend data
    initial_state = {
        "searching_for_restaurant": request.searching_for_restaurant,
        "lat" : request.latitude,
        "lon" : request.longitude,
    }
    
    # run graph agent
    final_state = graph.invoke(initial_state)
    
    # return optimized meal plan to frontend
    return {
        "status": "success",
        "meal_plan": final_state["current_restaurant"] 
    }