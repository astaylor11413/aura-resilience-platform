import os
from flask import Flask, jsonify, request
from flask_cors import CORS
from pydantic import BaseModel, Field, ValidationError
from typing import List
from scipy.spatial import distance
from database import mock_supply_db, mock_demand_db

app = Flask(__name__)
CORS(app)

class FoodSurplusPayload(BaseModel):
    restaurant_id: str
    restaurant_name: str
    coordinates: List[float] = Field(..., min_items=2, max_items=2)
    meal_type: str
    portions_available: int = Field(..., gt=0)
    verification_permit: str

@app.route('/api/v1/health', methods=['GET'])
def health_check():
    return jsonify({"status": "healthy", "engine": "Flask-Resilience-Core"}), 200

@app.route('/api/v1/resilience/simulate-grid', methods=['GET'])
def simulate_grid():
    wind_speed = request.args.get('wind_speed_mph', default=25.0, type=float)
    nodes = [
        {"id": "node-1", "name": "Kingston General Hospital Substation", "type": "Critical", "lat": 17.97, "lng": -76.78, "status": "Stable"},
        {"id": "node-2", "name": "Palisadoes Main Transmission Feed", "type": "Main-Line", "lat": 17.94, "lng": -76.75, "status": "Stable"},
        {"id": "node-3", "name": "Portmore Microgrid Hub", "type": "Microgrid", "lat": 17.95, "lng": -76.88, "status": "Stable"}
    ]
    for node in nodes:
        if wind_speed >= 55.0:
            if node["type"] == "Main-Line":
                node["status"] = "COLLAPSED / SEVERED"
            elif node["type"] in ["Critical", "Microgrid"]:
                node["status"] = "ISLANDED MODE (Battery & Micro-Wind Operational)"
                
    return jsonify({
        "input_wind_speed": wind_speed,
        "grid_status_code": "CRITICAL" if wind_speed >= 55.0 else "NOMINAL",
        "nodes": nodes
    }), 200

@app.route('/api/v1/mutual-aid/supply', methods=['POST'])
def report_surplus():
    try:
        payload = FoodSurplusPayload(**request.get_json())
    except ValidationError as e:
        return jsonify({"error": "Validation Error", "details": e.errors()}), 400

    if not payload.verification_permit.startswith("NYC-HLTH"):
        return jsonify({"error": "Access Denied: Invalid Municipal Permit ID."}), 403
    
    mock_supply_db.append(payload.model_dump())
    return jsonify({"status": "success", "message": "Verified surplus logged."}), 201

@app.route('/api/v1/mutual-aid/routes', methods=['GET'])
def calculate_optimal_routing():
    routes_geojson = {"type": "FeatureCollection", "features": []}
    for shelter in mock_demand_db:
        if shelter["meals_needed"] <= 0: continue
        closest_restaurant, min_dist = None, float('inf')
        for restaurant in mock_supply_db:
            if restaurant["portions_available"] > 0:
                dist = distance.euclidean(shelter["coordinates"], restaurant["coordinates"])
                if dist < min_dist:
                    min_dist, closest_restaurant = dist, restaurant
        if closest_restaurant:
            allocation = min(closest_restaurant["portions_available"], shelter["meals_needed"])
            routes_geojson["features"].append({
                "type": "Feature",
                "properties": {
                    "origin": closest_restaurant["restaurant_name"],
                    "destination": shelter["shelter_name"],
                    "allocation_size": allocation,
                    "urgency": shelter["urgency_level"]
                },
                "geometry": {
                    "type": "LineString",
                    "coordinates": [closest_restaurant["coordinates"], shelter["coordinates"]]
                }
            })
    return jsonify(routes_geojson), 200

if __name__ == '__main__':
    app.run(port=8000, debug=True)