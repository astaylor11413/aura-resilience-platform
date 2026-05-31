# aura-resilience-platform
An intelligent climate resilience utility pairing critical infrastructure microgrid isolation modeling with dialect-aware AI logistics engines for coastal disaster mitigation.

Aura: Unified Urban & Coastal Resilience UtilityAura is an intelligent, full-stack climate resilience platform designed to safeguard vulnerable coastal populations, island networks, and urban food grids during severe meteorological events. By combining real-time environmental telemetry, predictive critical infrastructure modeling, automated microgrid isolation sequences, and an AI-driven, dialect-aware field logistics engine, Aura provides an emergency management blueprint when centralized networks fail.

Core Architectural Pillars

1. Multi-Hazard Infrastructure MatrixDynamic Coastal Inundation Simulation: Maps topographical vulnerabilities using digital elevation models (DEM) combined with variable, multi-slider sea-level rise (SLR) modeling.Autonomous Microgrid Islanding: Simulates kinetic wind-energy harvesting curves (using NREL-inspired mathematical logic) to automatically transition critical nodes (such as hospitals and local arrays) into isolated, self-sustaining microgrids if high-voltage transmission lines fail.

2. AI Linguistic Telemetry PortalLocalized Speech-to-Text (STT): Uses context-prompted OpenAI Whisper models to ingest field incident reports, bypassing language barriers by accurately parsing regional dialects and syntaxes (e.g., Jamaican Patois).Targeted Outbound Audio Broadcasts (TTS): Leverages ElevenLabs synthesis to stream accent-accurate, dialect-mapped vocal warnings and evacuation updates to local communities.

3. Spatial Mutual Aid Routing EngineCalorie Reserve Allocation: Employs a nearest-neighbor spatial matrix (Euclidean optimization) to immediately bridge post-disaster supply gaps—directly routing local small-business and restaurant food surpluses to active emergency shelters. The Technical StackLayerTechnologies UtilizedFrontendReact.js, Vite, Mapbox GL JS (Spatial Vector Mapping), Tailwind CSS, Lucide IconsBackendPython, Flask (RESTful Microservices), SciPy (Spatial Vector Math), Pydantic (Strict Data Validation), GunicornAI LayerOpenAI API (Whisper-1), ElevenLabs API (Custom Audio Voice IDs)DeploymentRender (Unified Microservice Web Services & Static Asset Pipelines) 

Repository StructurePlaintextaura-resilience-platform/
├── backend/
│   ├── app.py                # Unified Flask Resilience Server & API Gateways
│   ├── database.py           # Core Spatial Data Storage & Asset Coordinates
│   └── requirements.txt      # Python Production Dependency Matrix
└── frontend/
    ├── src/
    │   ├── App.jsx           # Full-Spectrum Interactive Map Panel & UI Contols
    │   └── main.jsx
    ├── index.html
    └── package.json          # Node Production Module Manifest

Quickstart: Local Environment Replication
Ensure you have Node.js, Python 3.10+, and a Mapbox Public Access Token installed locally.

1. Initialize the Backend ServiceBashcd backend
python -m venv venv
source venv/bin/activate  # On Windows use: venv\Scripts\activate
pip install -r requirements.txt

# Export your secure infrastructure environment variables
export OPENAI_API_KEY="your_openai_key"
export ELEVENLABS_API_KEY="your_elevenlabs_key"

python app.py
The backend engine will spin up on [http://127.0.0.1:8000]
(http://127.0.0.1:8000)

2. Initialize the Frontend WorkspaceBashcd ../frontend
npm install
npm run dev
Open your browser to the local development environment port indicated by Vite to interact with the full telemetry suite.