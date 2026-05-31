import os
from flask import Flask, jsonify, request
from flask_cors import CORS
from pydantic import BaseModel, Field, ValidationError
from typing import List
from scipy.spatial import distance

# In-memory spatial state matrices
from database import mock_supply_db, mock_demand_db, mock_ocean_anomalies, mock_coastal_dem

app = Flask(__name__)
CORS(app)

class FoodSurplusPayload(BaseModel):
    restaurant_id: str
    restaurant_name: str
    coordinates: List[float] = Field(..., min_items=2, max_items=2) # [Lng, Lat]
    meal_type: str
    portions_available: int = Field(..., gt=0)
    verification_permit: str

# 1. Enterprise Health Check
@app.route('/api/v1/health', methods=['GET'])
def health_check():
    return jsonify({"status": "healthy", "engine": "Aura-Core-Engine"}), 200

# 2. Ocean Satellite Telemetry & AI Watchdog
@app.route('/api/v1/ocean/telemetry', methods=['GET'])
def get_ocean_telemetry():
    features = []
    for anomaly in mock_ocean_anomalies:
        # AI Watchdog classification simulation logic
        ai_threat_flag = "CRITICAL_STORM_INCUBATION" if anomaly["temp_anomaly"] >= 2.5 and anomaly["plastic_density"] > 400 else "MONITOR"
        
        features.append({
            "type": "Feature",
            "properties": {
                "location_name": anomaly["name"],
                "surface_temp_anomaly_celsius": anomaly["temp_anomaly"],
                "microplastic_density_ppm": anomaly["plastic_density"],
                "ai_watchdog_status": ai_threat_flag
            },
            "geometry": {
                "type": "Point",
                "coordinates": anomaly["coordinates"]
            }
        })
    return jsonify({"type": "FeatureCollection", "features": features}), 200

# 3. NEW: NOAA Coastal Inundation Simulator Engine
@app.route('/api/v1/hazard/inundation', methods=['GET'])
def simulate_inundation():
    """
    Simulates coastal flooding profiles based on digital elevation heights.
    Filters out and yields zones breached by user-defined Sea Level Rise (SLR) sliders.
    """
    slr_meters = request.args.get('slr_meters', default=0.0, type=float)
    flooded_features = {"type": "FeatureCollection", "features": []}
    
    for zone in mock_coastal_dem:
        # If the sea level rise exceeds the natural topographical elevation height, mark as breached
        if slr_meters >= zone["elevation_m"]:
            flooded_features["features"].append({
                "type": "Feature",
                "properties": {
                    "zone_name": zone["name"],
                    "topographical_elevation_m": zone["elevation_m"],
                    "risk_state": "BREACHED / FLOODED"
                },
                "geometry": {
                    "type": "Polygon",
                    "coordinates": zone["polygon_coordinates"]
                }
            })
    return jsonify(flooded_features), 200

# 4. Grid Microgrid Orchestrator Simulation
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
            if node["type"] == "Main-Line": node["status"] = "COLLAPSED / SEVERED"
            elif node["type"] in ["Critical", "Microgrid"]:
                node["status"] = "ISLANDED MODE (Battery & Distributed Wind Engaged)"
                
    return jsonify({"input_wind_speed": wind_speed, "grid_status_code": "CRITICAL" if wind_speed >= 55.0 else "NOMINAL", "nodes": nodes}), 200

# 5. Verified Mutual Aid Supply Ingestion
@app.route('/api/v1/mutual-aid/supply', methods=['POST'])
def report_surplus():
    try:
        payload = FoodSurplusPayload(**request.get_json())
    except ValidationError as e:
        return jsonify({"error": "Validation Error", "details": e.errors()}), 400

    if not payload.verification_permit.startswith("NYC-HLTH"):
        return jsonify({"error": "Access Denied: Invalid Permit."}), 403
    
    mock_supply_db.append(payload.model_dump())
    return jsonify({"status": "success", "message": "Verified surplus logged."}), 201

# 6. Spatial Routing Nearest-Neighbor Optimizer
@app.route('/api/v1/mutual-aid/routes', methods=['GET'])
def calculate_optimal_routing():
    routes_geojson = {"type": "FeatureCollection", "features": []}
    for shelter in mock_demand_db:
        if shelter["meals_needed"] <= 0: continue
        closest_restaurant, min_dist = None, float('inf')
        for restaurant in mock_supply_db:
            if restaurant["portions_available"] > 0:
                dist = distance.euclidean(shelter["coordinates"], restaurant["coordinates"])
                if dist < min_dist: min_dist, closest_restaurant = dist, restaurant
        if closest_restaurant:
            allocation = min(closest_restaurant["portions_available"], shelter["meals_needed"])
            routes_geojson["features"].append({
                "type": "Feature",
                "properties": {
                    "origin": closest_restaurant["restaurant_name"],
                    "destination": shelter["shelter_name"],
                    "allocation_size": allocation
                },
                "geometry": {
                    "type": "LineString",
                    "coordinates": [closest_restaurant["coordinates"], shelter["coordinates"]]
                }
            })
    return jsonify(routes_geojson), 200

if __name__ == '__main__':
    app.run(port=8000, debug=True)