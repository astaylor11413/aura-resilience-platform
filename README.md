# AURA Resilience Platform

Aura is a full-stack climate resilience platform designed to safeguard coastal populations, island networks, and urban food grids. It combines real-time environmental telemetry, predictive critical infrastructure modeling, and an AI-driven, dialect-aware logistics engine.

## Core Architectural Pillars
* **Multi-Hazard Infrastructure Matrix:** Dynamic coastal inundation simulation and automated microgrid islanding protocols for critical nodes.
* **AI Linguistic Telemetry Portal:** Context-aware STT/TTS models optimized for regional dialects to ensure clear communication during network disruptions.
* **Spatial Mutual Aid Routing:** Real-time logistics optimization for calorie distribution from local surplus hubs to emergency shelters.
* **Edge-Orchestration (Air-Gapped Mode):** An autonomous fallback mode that migrates triage and grid-logic computation from cloud-based APIs to client-side edge compute.

## Technical Stack
- **Frontend:** React.js, Vite, Mapbox GL JS, Tailwind CSS, Lucide Icons
- **Backend:** Python 3.10+, Flask, SciPy, Pydantic
- **AI Layer:** OpenAI (Whisper), ElevenLabs, Edge-side Triage Engines
- **DevOps:** Docker, Render (Unified Pipeline)

## Prerequisites
- Node.js: v18+
- Python: v3.10+
- Mapbox Account (for `VITE_MAPBOX_ACCESS_TOKEN`)
- Docker (Recommended for production)

## Local Development Setup

### 1. Backend Environment
```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Configure Environment Variables
export OPENAI_API_KEY="your_openai_key"
export ELEVENLABS_API_KEY="your_elevenlabs_key"
export MAPBOX_ACCESS_TOKEN="your_mapbox_token"

python app.py
