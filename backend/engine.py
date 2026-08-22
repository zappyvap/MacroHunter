from google.genai.types import MediaModality
from asyncio import base_events
import json
import time
from langchain_core.runnables import config
from fastapi import HTTPException
import base64
from fastapi import FastAPI, Form, File, UploadFile
from pydantic import BaseModel
# import the LangGraph state machine that orchestrates the full search/vision pipeline
# pyrefly: ignore [missing-import]
from graph import graph 
from fastapi.middleware.cors import CORSMiddleware
from collections.abc import AsyncIterable
from starlette.responses import StreamingResponse
import uuid
from typing import Any, Callable, TypedDict

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

class ImageRequest(BaseModel):
    image_b64: str
    target_calories: float
    target_protein: float
    target_carbs: float
    target_fats: float

class NodeTranslation(TypedDict):
    ui_message: str
    parse_fn: Callable[[Any], str]

NODE_TRANSLATIONS: dict[str, NodeTranslation] = {
    "find_restaurants": {
        "ui_message": "🔍 Scanning menus at nearby restaurants...",
        "parse_fn": lambda output: f"Found {len(output.get('found_restaurants', []))} restaurants to evaluate."
    },
    "fetch_and_optimize": {
        "ui_message": "🧬 Calculating macronutrient balances...",
        "parse_fn": lambda output: "Matching items against your target protein and calories..."
    },
    "image_translation": {
        "ui_message": "🧬 Calculating macros...",
        "parse_fn": lambda output: "Extracting protein and calorie counts from menu..."
    },
    "optimizer": {
        "ui_message": "Optimizing menu items...",
        "parse_fn": lambda output: f"Optimizing {len(output.get('best_orders', []))} menu items..."
    },
    "judge":{
        "ui_message": "Adding final touches...",
        "parse_fn": lambda output: "Sorting by price..."
    }
}

async def stream_helper(initial_state):
    my_graph_config = {
        "configurable": {
            "thread_id": str(uuid.uuid4()) # Generates a fresh random ID for this run
        }
    }
    user_message = "Done"
    detail_text = ""
    final_orders = []
    request_start = time.perf_counter()
    last_ts = request_start
    try:
        # yield immediately so the UI updates instantly
        yield f"event: agent_update\ndata: {json.dumps({'status': 'processing', 'headline': '🔍 Finding restaurants near you...', 'detail': ''})}\n\n"
        async for chunk in graph.astream(initial_state, config=my_graph_config, stream_mode="updates"):
            node_name, node_output = next(iter(chunk.items()))
            now = time.perf_counter()
            split = now - last_ts
            total = now - request_start
            print(f"⏱  [stream] {node_name}: +{split:.2f}s (total: {total:.2f}s)")
            last_ts = now
            # capture the final results whenever the judge node runs
            if node_name == "judge" and node_output.get("final_orders"):
                final_orders = node_output["final_orders"]
            if node_name in NODE_TRANSLATIONS:
                n_config = NODE_TRANSLATIONS[node_name]
                user_message = n_config["ui_message"]
                detail_text = n_config["parse_fn"](node_output)
            else:
                user_message = f"Executing step: {node_name}"
                detail_text = ""
            yield f"event: agent_update\ndata: {json.dumps({'status': 'processing', 'headline': user_message, 'detail': detail_text})}\n\n"
        total = time.perf_counter() - request_start
        print(f"⏱  [stream] TOTAL request: {total:.2f}s")
        yield f"event: done\ndata: {json.dumps({'status': 'done', 'headline': user_message, 'detail': detail_text, 'results': final_orders})}\n\n"
    except Exception as e:
        yield f"event: error\ndata: {json.dumps({'detail': str(e)})}\n\n"
    
# Endpoint 1: Standard JSON for Search/Hunt
@app.post("/api/optimize-meal")
async def run_macro_hunter(request: UserRequest):
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
    return StreamingResponse(stream_helper(initial_state), media_type="text/event-stream")
    


async def image_stream_helper(initial_state):
    my_graph_config = {
        "configurable": {
            "thread_id": str(uuid.uuid4()) # Generates a fresh random ID for this run
        }
    }
    user_message = "Done"
    detail_text = ""
    final_orders = []
    request_start = time.perf_counter()
    last_ts = request_start
    try:
        # yield immediately so the UI doesn't look stuck while Gemini runs for 15s
        yield f"event: agent_update\ndata: {json.dumps({'status': 'processing', 'headline': '📷 Reading menu layout and identifying items...', 'detail': ''})}\n\n"
        async for chunk in graph.astream(initial_state, config=my_graph_config, stream_mode="updates"):
            node_name, node_output = next(iter(chunk.items()))
            now = time.perf_counter()
            split = now - last_ts
            total = now - request_start
            print(f"⏱  [stream] {node_name}: +{split:.2f}s (total: {total:.2f}s)")
            last_ts = now
            # capture the final results whenever the judge node runs
            if node_name == "judge" and node_output.get("final_orders"):
                final_orders = node_output["final_orders"]
            if node_name in NODE_TRANSLATIONS:
                n_config = NODE_TRANSLATIONS[node_name]
                user_message = n_config["ui_message"]
                detail_text = n_config["parse_fn"](node_output)
            else:
                user_message = f"Executing step: {node_name}"
                detail_text = ""
            yield f"event: agent_update\ndata: {json.dumps({'status': 'processing', 'headline': user_message, 'detail': detail_text})}\n\n"
        total = time.perf_counter() - request_start
        print(f"⏱  [stream] TOTAL request: {total:.2f}s")
        yield f"event: done\ndata: {json.dumps({'status': 'done', 'headline': user_message, 'detail': detail_text, 'results': final_orders})}\n\n"
    except Exception as e:
        yield f"event: error\ndata: {json.dumps({'detail': str(e)})}\n\n"

# Endpoint 2b: JSON+base64 streaming endpoint for camera scans
@app.post("/api/optimize-menu-image-stream")
async def run_macro_hunter_image_stream(request: ImageRequest):
    if not request.image_b64:
        raise HTTPException(status_code=400, detail="No image data provided")
    initial_state = {
        "searching_for_restaurant": False,
        "lat": None,
        "lon": None,
        "target_calories": request.target_calories,
        "target_protein": request.target_protein,
        "target_carbs": request.target_carbs,
        "target_fats": request.target_fats,
        "current_restaurant_index": 0,
        "image_b64": request.image_b64,
    }
    return StreamingResponse(image_stream_helper(initial_state), media_type="text/event-stream")

# Endpoint 2a: Multipart Form-Data specifically for camera scans (legacy fallback)
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
        
    return StreamingResponse(image_stream_helper(initial_state), media_type='text/event-stream')