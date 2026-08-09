from fastapi import HTTPException
import base64
from fastapi import FastAPI, Form, File, UploadFile
from pydantic import BaseModel
# import the LangGraph state machine that orchestrates the full search/vision pipeline
from graph import graph 
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

# allow all origins so the Expo frontend can call the API from any device on the local network
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
    try:
        final_state = graph.invoke(initial_state)
    except Exception as e:
        # Catch any unexpected crashes in the graph and return a 500
        raise HTTPException(status_code=500, detail="An unexpected error occurred while searching. Please try again.")
        
    # If the graph runs successfully but finds no meals, raise a 404
    if not final_state.get("final_orders"):
        raise HTTPException(status_code=404, detail="No meals matching your macros were found near you. Try a different area or broader targets.")
        
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
    if not target_calories or not target_protein or not target_carbs or not target_fats:
        raise HTTPException(status_code=400, detail="Target macronutrients not set")
    
    if not file:
        raise HTTPException(status_code=400, detail="File not found")
        
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
    
    try:
        final_state = graph.invoke(initial_state)
    except Exception as e:
        raise HTTPException(status_code=500, detail="An unexpected error occurred while scanning the menu. Please try again.")
        
    if not final_state.get("final_orders"):
        raise HTTPException(status_code=404, detail="No meals matching your macros were found on this menu.")
        
    return {
        "status": "success",
        "results": final_state["final_orders"] 
    }