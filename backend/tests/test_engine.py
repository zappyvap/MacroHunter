import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock
from engine import app

client = TestClient(app)

def test_optimize_meal_success():
    with patch("engine.graph.invoke") as mock_invoke:
        mock_invoke.return_value = {"final_orders": ["order1", "order2"]}
        
        response = client.post("/api/optimize-meal", json={
            "searching_for_restaurant": True,
            "latitude": 40.7128,
            "longitude": -74.0060,
            "target_calories": 500,
            "target_protein": 30,
            "target_carbs": 40,
            "target_fats": 15
        })
        
        assert response.status_code == 200
        assert response.json()["status"] == "success"
        assert response.json()["results"] == ["order1", "order2"]

def test_optimize_meal_missing_fields_422():
    # Sending empty body should trigger FastAPI validation error (422)
    response = client.post("/api/optimize-meal", json={})
    assert response.status_code == 422

def test_optimize_meal_graph_exception_500():
    with patch("engine.graph.invoke") as mock_invoke:
        mock_invoke.side_effect = Exception("Graph crashed")
        
        response = client.post("/api/optimize-meal", json={
            "searching_for_restaurant": True,
            "latitude": 40.7128,
            "longitude": -74.0060,
            "target_calories": 500,
            "target_protein": 30,
            "target_carbs": 40,
            "target_fats": 15
        })
        
        assert response.status_code == 500
        assert "unexpected error" in response.json()["detail"].lower()

def test_optimize_meal_no_results_404():
    with patch("engine.graph.invoke") as mock_invoke:
        # Simulate successful run but no orders found
        mock_invoke.return_value = {"final_orders": []}
        
        response = client.post("/api/optimize-meal", json={
            "searching_for_restaurant": True,
            "latitude": 40.7128,
            "longitude": -74.0060,
            "target_calories": 500,
            "target_protein": 30,
            "target_carbs": 40,
            "target_fats": 15
        })
        
        assert response.status_code == 404
        assert "no meals matching" in response.json()["detail"].lower()

def test_optimize_menu_image_success():
    with patch("engine.graph.invoke") as mock_invoke:
        mock_invoke.return_value = {"final_orders": ["order1"]}
        
        response = client.post(
            "/api/optimize-menu-image",
            data={
                "target_calories": 500.0,
                "target_protein": 30.0,
                "target_carbs": 40.0,
                "target_fats": 15.0
            },
            files={"file": ("menu.jpg", b"fake image bytes", "image/jpeg")}
        )
        
        assert response.status_code == 200
        assert response.json()["status"] == "success"
        assert response.json()["results"] == ["order1"]

def test_optimize_menu_image_missing_fields_422():
    # Omit the required files and form data
    response = client.post("/api/optimize-menu-image")
    assert response.status_code == 422

def test_optimize_menu_image_falsy_macro_400():
    # If target_calories is 0, the manual check `if not target_calories:` will throw a 400
    response = client.post(
        "/api/optimize-menu-image",
        data={
            "target_calories": 0.0, 
            "target_protein": 30.0,
            "target_carbs": 40.0,
            "target_fats": 15.0
        },
        files={"file": ("menu.jpg", b"fake image bytes", "image/jpeg")}
    )
    assert response.status_code == 400
    assert "macronutrients not set" in response.json()["detail"].lower()
