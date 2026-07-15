import base64
from fastapi import FastAPI, Form, File, UploadFile
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

class UserRequest(BaseModel):
    searching_for_restaurant: bool
    latitude: float | None = None
    longitude: float | None = None
    target_calories: float
    target_protein: float
    target_carbs: float
    target_fats: float

# Endpoint 1: Standard JSON for Search/Hunt
@app.post("/api/optimize-meal")
def run_macro_hunter(request: UserRequest):
    initial_state = {
        "searching_for_restaurant": request.searching_for_restaurant,
        "lat" : request.latitude,
        "lon" : request.longitude,
        "target_calories": request.target_calories,
        "target_protein": request.target_protein,
        "target_carbs": request.target_carbs,
        "target_fats": request.target_fats,
        "current_restaurant_index": 0,
        "image_b64" : None
    }
    final_state = graph.invoke(initial_state)
    print("final_state keys:", final_state.keys())
    print("final_orders:", final_state.get("final_orders"))
    print("best_orders:", final_state.get("best_orders"))
    # return optimized meal plan to frontend
    return {
        "status": "success",
        "results": final_state["final_orders"] 
    }

# Endpoint 2: Multipart Form-Data specifically for camera scans
@app.post("/api/optimize-menu-image")
async def run_macro_hunter_image(
    target_calories: float = Form(...),
    target_protein: float = Form(...),
    target_carbs: float = Form(...),
    target_fats: float = Form(...),
    file: UploadFile = File(...)
):
    image_bytes = await file.read()
    image_b64 = base64.b64encode(image_bytes).decode('utf-8')
    
    initial_state = {
        "searching_for_restaurant": False,
        "lat" : None,
        "lon" : None,
        "target_calories": target_calories,
        "target_protein": target_protein,
        "target_carbs": target_carbs,
        "target_fats": target_fats,
        "current_restaurant_index": 0,
        "image_b64" : image_b64
    }
    
    final_state = graph.invoke(initial_state)
    print("final_state keys:", final_state.keys())
    print("final_orders:", final_state.get("final_orders"))
    print("best_orders:", final_state.get("best_orders"))
    return {
        "status": "success",
        "results": final_state["final_orders"] 
    }