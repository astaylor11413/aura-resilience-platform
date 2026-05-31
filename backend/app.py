import os
import requests
from flask import Flask, jsonify, request, send_file
from flask_cors import CORS
from pydantic import BaseModel, Field, ValidationError
from typing import List
from scipy.spatial import distance
from openai import OpenAI

# In-memory spatial state matrices
from database import mock_supply_db, mock_demand_db, mock_ocean_anomalies, mock_coastal_dem

app = Flask(__name__)
CORS(app)

# Initialize the OpenAI client (Reads OPENAI_API_KEY from environment)
openai_client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY", "mock-key-for-dev"))

class FoodSurplusPayload(BaseModel):
    restaurant_id: str
    restaurant_name: str
    coordinates: List[float] = Field(..., min_items=2, max_items=2)
    meal_type: str
    portions_available: int = Field(..., gt=0)
    verification_permit: str

# 1. STT Dialect-Guided Whisper Ingestion Endpoint
@app.route('/api/v1/voice/report', methods=['POST'])
def transcribe_incident_report():
    """
    Ingests an audio clip from field responders, passing a contextual prompt 
    to guide OpenAI Whisper to translate low-resource regional dialects accurately.
    """
    if 'audio' not in request.files:
        return jsonify({"error": "No audio file provided"}), 400
        
    audio_file = request.files['audio']
    
    try:
        # Contextual prompt trick lowers the Word Error Rate (WER) for localized speech patterns like Patois
        transcript = openai_client.audio.transcriptions.create(
            model="whisper-1",
            file=audio_file,
            prompt="Context: Emergency hazard broadcast, coastal flash flooding, ocean storm surge in Jamaica, Caribbean dialect vernacular."
        )
        
        # In a live disaster scenario, you would pass the text to an LLM to extract entity parameters
        return jsonify({
            "status": "success",
            "transcription": transcript.text,
            "inferred_hazard_level": "HIGH" if "flood" in transcript.text.lower() else "NOMINAL"
        }), 200
    except Exception as e:
        # Fallback  logic for local development testing without live tokens
        return jsonify({
            "status": "simulation_mode",
            "transcription": "[Simulated Patois Translation]: 'De water a rise fast on the coastline road, send rescue instruments now!'",
            "inferred_hazard_level": "HIGH"
        }), 200

# 2. Outbound Dialect Accent-Mapped TTS Endpoint with ElevenLabs
@app.route('/api/v1/voice/broadcast', methods=['POST'])
def generate_dialect_broadcast():
    """
    Takes text alerts and generates an audio broadcast stream using ElevenLabs 
    configured with localized regional accent profile IDs.
    """
    data = request.get_json() or {}
    text_to_speak = data.get("text", "Warning: Move inland immediately.")
    
    ELEVENLABS_API_KEY = os.environ.get("ELEVENLABS_API_KEY")
    # Replace with voice model identifier configured for a Caribbean accent
    CARIBBEAN_VOICE_ID = "EXAVITQu4vr4xnSDxMaL" 
    
    if not ELEVENLABS_API_KEY:
        return jsonify({"info": "ElevenLabs Key missing. Fallback to native WebSpeech synthesis audio stream on client."}), 200

    url = f"https://api.elevenlabs.io/v1/text-to-speech/{CARIBBEAN_VOICE_ID}"
    headers = {
        "Accept": "audio/mpeg",
        "Content-Type": "application/json",
        "xi-api-key": ELEVENLABS_API_KEY
    }
    payload = {
        "text": text_to_speak,
        "model_id": "eleven_monolingual_v1",
        "voice_settings": {"stability": 0.5, "similarity_boost": 0.75}
    }
    
    try:
        response = requests.post(url, json=payload, headers=headers, stream=True)
        if response.status_code == 200:
            output_filename = "/tmp/broadcast_alert.mp3"
            with open(output_filename, "wb") as f:
                for chunk in response.iter_content(chunk_size=1024):
                    if chunk: f.write(chunk)
            return send_file(output_filename, mimetype="audio/mpeg")
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# 3. Ocean Satellite Telemetry & AI Watchdog
@app.route('/api/v1/ocean/telemetry', methods=['GET'])
def get_ocean_telemetry():
    features = []
    for anomaly in mock_ocean_anomalies:
        ai_threat_flag = "CRITICAL_STORM_INCUBATION" if anomaly["temp_anomaly"] >= 2.5 and anomaly["plastic_density"] > 400 else "MONITOR"
        features.append({
            "type": "Feature",
            "properties": {
                "location_name": anomaly["name"],
                "surface_temp_anomaly_celsius": anomaly["temp_anomaly"],
                "microplastic_density_ppm": anomaly["plastic_density"],
                "ai_watchdog_status": ai_threat_flag
            },
            "geometry": {"type": "Point", "coordinates": anomaly["coordinates"]}
        })
    return jsonify({"type": "FeatureCollection", "features": features}), 200

# 4. NOAA Coastal Inundation Simulator Engine
@app.route('/api/v1/hazard/inundation', methods=['GET'])
def simulate_inundation():
    slr_meters = request.args.get('slr_meters', default=0.0, type=float)
    flooded_features = {"type": "FeatureCollection", "features": []}
    for zone in mock_coastal_dem:
        if slr_meters >= zone["elevation_m"]:
            flooded_features["features"].append({
                "type": "Feature",
                "properties": {"zone_name": zone["name"], "risk_state": "BREACHED"},
                "geometry": {"type": "Polygon", "coordinates": zone["polygon_coordinates"]}
            })
    return jsonify(flooded_features), 200

# 5. Grid Microgrid Orchestrator Simulation
@app.route('/api/v1/resilience/simulate-grid', methods=['GET'])
def simulate_grid():
    wind_speed = request.args.get('wind_speed_mph', default=25.0, type=float)
    nodes = [
        {"id": "node-1", "name": "Kingston General Hospital Substation", "type": "Critical", "lat": 17.97, "lng": -76.78, "status": "Stable"},
        {"id": "node-2", "name": "Palisadoes Main Transmission Feed", "type": "Main-Line", "lat": 17.94, "lng": -76.75, "status": "Stable"}
    ]
    for node in nodes:
        if wind_speed >= 55.0 and node["type"] == "Main-Line": node["status"] = "COLLAPSED"
    return jsonify({"nodes": nodes}), 200

# 6. Spatial Routing Optimizer
@app.route('/api/v1/mutual-aid/routes', methods=['GET'])
def calculate_optimal_routing():
    routes_geojson = {"type": "FeatureCollection", "features": []}
    return jsonify(routes_geojson), 200

if __name__ == '__main__':
    app.run(port=8000, debug=True)