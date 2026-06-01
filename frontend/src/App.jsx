import React, { useState, useEffect } from 'react';
import Map, { Source, Layer, Marker } from 'react-map-gl';
import { 
  Wind, Activity, Volume2, ShieldAlert, Zap, Radio, 
  Map as MapIcon, Sliders, AlertTriangle, FileText, CheckCircle2 
} from 'lucide-react';
import 'mapbox-gl/dist/mapbox-gl.css';

const MAPBOX_TOKEN = 'pk.eyJ1IjoiYXN0YXlsb3IxMTQxMyIsImEiOiJjbXB1cmpydmMxd3BuMnNwejZpaWo5ejExIn0.kxy1wEs_hpg5ZYB-2Z3daw';
const BACKEND_API_BASE = "https://aura-resilience-platform-qa.onrender.com/";

export default function App() {
  const [viewState, setViewState] = useState({ latitude: 17.96, longitude: -76.79, zoom: 9.2 });
  const [windSpeed, setWindSpeed] = useState(25);
  const [slrMeters, setSlrMeters] = useState(0.0);
  const [gridData, setGridData] = useState(null);
  const [floodGeoJson, setFloodGeoJson] = useState(null);
  const [activeOutputKw, setActiveOutputKw] = useState(0);

  // Aura State Management
  const [airGapped, setAirGapped] = useState(false);
  const [incidentText, setIncidentText] = useState("");
  const [selectedImage, setSelectedImage] = useState(null);
  const [playbookResult, setPlaybookResult] = useState(null);
  const [loadingPipeline, setLoadingPipeline] = useState(false);
  const [activeThreatIndex, setActiveThreatIndex] = useState(null);
  
  // Mobile Tab State: 'controls' or 'map'
  const [activeTab, setActiveTab] = useState('controls');

  useEffect(() => {
    let url = `${BACKEND_API_BASE}/api/v1/resilience/simulate-grid?wind_speed_mph=${windSpeed}`;
    if (activeThreatIndex !== null) url += `&threat_index=${activeThreatIndex}`;
    
    fetch(url)
      .then(res => res.json())
      .then(data => {
        setGridData(data);
        setActiveOutputKw(data.calculated_der_output_kw);
      })
      .catch(err => console.error("Grid Sync Fault:", err));
  }, [windSpeed, activeThreatIndex]);

  useEffect(() => {
    fetch(`${BACKEND_API_BASE}/api/v1/hazard/inundation?slr_meters=${slrMeters}`)
      .then(res => res.json())
      .then(data => setFloodGeoJson(data))
      .catch(err => console.error("Inundation Sync Fault:", err));
  }, [slrMeters]);

  const triggerResilientOrchestrationStory = () => {
    setWindSpeed(78);
    setSlrMeters(2.0);
    executeVoiceBroadcast("Warning: Main transmission lines near Kingston are compromised due to storm surge. Automating microgrid isolation procedures.");
  };

  const handleIncidentPipelineSubmit = (e) => {
    e.preventDefault();
    setLoadingPipeline(true);
    
    const formData = new FormData();
    formData.append("text", incidentText);
    formData.append("air_gapped", airGapped.toString());
    formData.append("wind_speed", windSpeed.toString());
    if (selectedImage) formData.append("image", selectedImage);

    fetch(`${BACKEND_API_BASE}/api/v1/voice/report`, {
      method: 'POST',
      body: formData
    })
    .then(res => res.json())
    .then(data => {
      setPlaybookResult(data);
      if (data.matched_node_threat_index !== null) {
        setActiveThreatIndex(data.matched_node_threat_index);
      }
      setLoadingPipeline(false);
      executeVoiceBroadcast(`Triage complete. Status identified: ${data.triage_incident_profile}`);
    })
    .catch((err) => {
      console.error("Pipeline Failure:", err);
      setLoadingPipeline(false);
    });
  };

  const executeVoiceBroadcast = (text) => {
    if (airGapped) {
      window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
      return;
    }
    fetch(`${BACKEND_API_BASE}/api/v1/voice/broadcast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: text })
    })
    .then(res => {
      const contentType = res.headers.get("content-type") || "";
      if (contentType.includes("audio") || contentType.includes("octet-stream")) {
        res.blob().then(b => new Audio(URL.createObjectURL(b)).play());
      } else {
        window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
      }
    })
    .catch(() => window.speechSynthesis.speak(new SpeechSynthesisUtterance(text)));
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans antialiased selection:bg-indigo-500/10">
      {/* Top Professional Clean Navbar */}
      <header className="px-6 py-4 bg-white border-b border-slate-200 flex justify-between items-center sticky top-0 z-50 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-50 rounded-xl border border-indigo-100">
            <Zap className="text-indigo-600" size={20} />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-slate-900">Aura Resilience</h1>
            <p className="text-xs text-slate-500 font-medium hidden sm:block">Community Disaster Response Dashboard</p>
          </div>
        </div>

        <button 
          onClick={() => setAirGapped(!airGapped)}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all duration-200 border shadow-sm ${
            airGapped 
              ? 'bg-amber-50 text-amber-700 border-amber-200' 
              : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
          }`}
        >
          <Radio size={14} className={airGapped ? 'animate-pulse text-amber-600' : 'text-slate-500'} />
          <span>{airGapped ? "Air-Gapped Local" : "Cloud Synchronized"}</span>
        </button>
      </header>

      {/* Main Content Body */}
      <div className="flex-1 flex flex-col md:flex-row relative overflow-hidden">
        
        {/* 💻 Controls Panel (Light Mode SaaS Dashboard Styling) */}
        <div className={`w-full md:w-[440px] p-5 lg:p-6 bg-white flex flex-col gap-5 overflow-y-auto border-r border-slate-200 shrink-0 z-20 ${
          activeTab === 'controls' ? 'flex' : 'hidden md:flex'
        }`}>
          
          {/* Quick Simulation Trigger */}
          <button 
            onClick={triggerResilientOrchestrationStory} 
            className="w-full bg-rose-600 hover:bg-rose-500 active:scale-[0.99] text-white py-3 px-4 rounded-xl font-semibold transition-all duration-150 flex items-center justify-center gap-2 shadow-sm text-sm"
          >
            <ShieldAlert size={18} />
            <span>Simulate Hurricane Impact</span>
          </button>

          {/* Premium Metric Readout Card */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-50 to-indigo-50/30 border border-indigo-100 shadow-sm">
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 block mb-1">Backup Generation Output</span>
            <div className="text-2xl font-extrabold text-slate-900 tracking-tight">
              {activeOutputKw.toLocaleString()} <span className="text-sm font-medium text-slate-500">kW Active</span>
            </div>
          </div>

          {/* Environmental Conditions Adjusters */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/60 flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-600 flex items-center gap-1.5 font-medium">
                  <Wind size={14} className="text-slate-400" /> Sustained Wind Speed
                </span>
                <span className="font-bold text-slate-800 bg-white px-2 py-0.5 rounded-md border border-slate-200">{windSpeed} MPH</span>
              </div>
              <input 
                type="range" min="15" max="100" value={windSpeed} 
                onChange={(e) => setWindSpeed(Number(e.target.value))}
                className="w-full accent-indigo-600 h-1 bg-slate-200 rounded-lg cursor-pointer"
              />
            </div>
            
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-600 flex items-center gap-1.5 font-medium">
                  <Activity size={14} className="text-slate-400" /> Coastal Storm Surge
                </span>
                <span className="font-bold text-slate-800 bg-white px-2 py-0.5 rounded-md border border-slate-200">{slrMeters.toFixed(1)}m</span>
              </div>
              <input 
                type="range" min="0.0" max="3.0" step="0.5" value={slrMeters} 
                onChange={(e) => setSlrMeters(parseFloat(e.target.value))}
                className="w-full accent-indigo-600 h-1 bg-slate-200 rounded-lg cursor-pointer"
              />
            </div>
          </div>

          {/* AI Intake Reporting Hub */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/60 flex flex-col gap-3">
            <div className="flex items-center gap-2 pb-1 border-b border-slate-200">
              <FileText size={14} className="text-indigo-600" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Emergency Situation Report</h3>
            </div>
            
            <form onSubmit={handleIncidentPipelineSubmit} className="flex flex-col gap-3">
              <textarea 
                value={incidentText}
                onChange={(e) => setIncidentText(e.target.value)}
                placeholder="Describe current location damage or grid failures here..."
                className="w-full h-20 bg-white border border-slate-200 focus:border-indigo-500 rounded-xl text-slate-800 text-sm p-3 focus:outline-none transition-all placeholder:text-slate-400 shadow-inner resize-none"
              />
              <div className="flex items-center justify-between gap-2 bg-white p-2 rounded-xl border border-slate-200 shadow-sm">
                <span className="text-xs text-slate-500 pl-1">Attach Drone Photo:</span>
                <input 
                  type="file" accept="image/*" 
                  onChange={(e) => setSelectedImage(e.target.files[0])} 
                  className="text-xs text-slate-500 file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-700 file:hover:bg-slate-200 file:cursor-pointer max-w-[180px]" 
                />
              </div>
              <button 
                type="submit" 
                disabled={loadingPipeline} 
                className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-200 text-white font-bold py-2.5 px-4 rounded-xl transition-all duration-150 text-xs shadow-sm active:scale-[0.99]"
              >
                {loadingPipeline ? "PROCESSING PIPELINE INFERENCE..." : "Submit Report to AI Triage"}
              </button>
            </form>
          </div>

          {/* AI Response Output Card (Clean High Contrast Layout) */}
          {playbookResult && (
            <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200/80 shadow-sm animate-fadeIn flex flex-col gap-2.5">
              <div className="flex items-center gap-2 text-emerald-700">
                <CheckCircle2 size={16} />
                <h4 className="text-xs font-bold uppercase tracking-wider">Tactical Action Directives</h4>
              </div>
              <p className="text-sm text-slate-800 font-semibold leading-relaxed">{playbookResult.actionable_tactical_playbook}</p>
              <div className="grid grid-cols-2 gap-2 mt-1 pt-2 border-t border-emerald-100 text-[11px] text-slate-500">
                <div><span>Triage Profile:</span> <span className="text-slate-800 font-semibold">{playbookResult.triage_incident_profile}</span></div>
                <div><span>Visual Feed:</span> <span className="text-slate-800 font-semibold">{playbookResult.visual_verification}</span></div>
              </div>
            </div>
          )}

          {/* Real-time Infrastructure Monitoring Tree */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/60 flex flex-col gap-3 min-h-[160px]">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Local Infrastructure Status</h4>
            <div className="flex flex-col gap-2.5 divide-y divide-slate-200/60">
              {gridData?.assets?.map(asset => {
                const isDown = asset.status.includes('DOWN');
                const isIslanded = asset.status.includes('ISLANDED');
                return (
                  <div key={asset.id} className="pt-2.5 first:pt-0 flex justify-between items-start gap-4">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">{asset.name}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">Vector: {asset.power_routing}</div>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase border tracking-wide whitespace-nowrap ${
                      isDown ? 'bg-rose-50 text-rose-700 border-rose-200' : 
                      isIslanded ? 'bg-sky-50 text-sky-700 border-sky-200' : 
                      'bg-emerald-50 text-emerald-700 border-emerald-200'
                    }`}>
                      {isDown ? 'Offline' : isIslanded ? 'Isolated' : 'Normal'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

        </div>

        {/* 🗺️ Mapbox Panel (Using high-contrast Light map layer framework matching light mode layout) */}
        <div className={`flex-1 relative min-h-[50vh] md:h-[calc(100vh-73px)] ${
          activeTab === 'map' ? 'block' : 'hidden md:block'
        }`}>
          <Map 
            {...viewState} 
            onMove={evt => setViewState(evt.viewState)} 
            mapStyle="mapbox://styles/mapbox/light-v11" 
            mapboxAccessToken={MAPBOX_TOKEN}
          >
            {floodGeoJson && (
              <Source id="flood" type="geojson" data={floodGeoJson}>
                <Layer type="fill" paint={{ 'fill-color': '#f43f5e', 'fill-opacity': 0.2 }} />
              </Source>
            )}
            
            {gridData?.assets?.map(asset => (
              <Marker key={asset.id} latitude={asset.coordinates[1]} longitude={asset.coordinates[0]}>
                <div 
                  className={`w-4 h-4 rounded-full border-2 border-white shadow-md cursor-pointer transform transition-transform hover:scale-125 ${
                    asset.status.includes('DOWN') ? 'bg-rose-500' : 
                    asset.status.includes('ISLANDED') ? 'bg-sky-400' : 
                    'bg-emerald-500'
                  }`}
                  title={asset.name}
                />
              </Marker>
            ))}
          </Map>
        </div>

        {/* 📱 Mobile Sticky Sub-Navigation Bar */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-slate-200 flex z-50 shadow-lg">
          <button 
            onClick={() => setActiveTab('controls')}
            className={`flex-1 flex flex-col items-center justify-center gap-1 text-xs font-semibold ${
              activeTab === 'controls' ? 'text-indigo-600 bg-slate-50' : 'text-slate-400'
            }`}
          >
            <Sliders size={18} />
            <span>Dashboard</span>
          </button>
          <button 
            onClick={() => setActiveTab('map')}
            className={`flex-1 flex flex-col items-center justify-center gap-1 text-xs font-semibold ${
              activeTab === 'map' ? 'text-indigo-600 bg-slate-50' : 'text-slate-400'
            }`}
          >
            <MapIcon size={18} />
            <span>Telemetry Map</span>
          </button>
        </div>

      </div>
    </div>
  );
}