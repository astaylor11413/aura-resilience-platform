import React, { useState, useEffect, useRef } from 'react';
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
  
  // 📱 Mobile Tab State: 'controls' or 'map'
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
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans antialiased selection:bg-teal-500/30">
      {/* Top Professional Navbar */}
      <header className="px-6 py-4 bg-slate-900/80 backdrop-blur-md border-b border-slate-800/60 flex justify-between items-center sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-teal-500/10 rounded-xl border border-teal-500/20">
            <Zap className="text-teal-400" size={20} />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-white">Aura Resilience</h1>
            <p className="text-xs text-slate-400 font-medium hidden sm:block">Community Disaster Response Platform</p>
          </div>
        </div>

        <button 
          onClick={() => setAirGapped(!airGapped)}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all duration-200 border shadow-sm ${
            airGapped 
              ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' 
              : 'bg-slate-800/50 text-slate-300 border-slate-700/50 hover:bg-slate-800'
          }`}
        >
          <Radio size={14} className={airGapped ? 'animate-pulse' : ''} />
          <span>{airGapped ? "Air-Gapped Mode" : "Network Connected"}</span>
        </button>
      </header>

      {/* Main Content Body */}
      <div className="flex-1 flex flex-col md:flex-row relative overflow-hidden">
        
        {/* 💻 Controls Panel (Full width on Mobile, fixed left on Desktop) */}
        <div className={`w-full md:w-[440px] p-5 lg:p-6 bg-slate-900 flex flex-col gap-5 overflow-y-auto border-r border-slate-800/50 shrink-0 z-20 ${
          activeTab === 'controls' ? 'flex' : 'hidden md:flex'
        }`}>
          
          {/* Quick Simulation Trigger */}
          <button 
            onClick={triggerResilientOrchestrationStory} 
            className="w-full bg-rose-600 hover:bg-rose-500 active:scale-[0.99] text-white py-3 px-4 rounded-xl font-semibold transition-all duration-150 flex items-center justify-center gap-2 shadow-lg shadow-rose-900/20 text-sm"
          >
            <ShieldAlert size={18} />
            <span>Simulate Hurricane Impact</span>
          </button>

          {/* Clean Metric Readout Card */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-800/40 to-slate-800/10 border border-slate-800/80 shadow-inner">
            <span className="text-[10px] font-bold uppercase tracking-wider text-teal-400 block mb-1">Backup Generation Output</span>
            <div className="text-2xl font-extrabold text-white tracking-tight">
              {activeOutputKw.toLocaleString()} <span className="text-sm font-medium text-slate-400">kW Active</span>
            </div>
          </div>

          {/* Environmental Conditions Adjusters */}
          <div className="p-4 rounded-2xl bg-slate-800/30 border border-slate-800/60 flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-300 flex items-center gap-1.5 font-medium">
                  <Wind size={14} className="text-slate-400" /> Sustained Wind Speed
                </span>
                <span className="font-bold text-white bg-slate-800 px-2 py-0.5 rounded-md border border-slate-700">{windSpeed} MPH</span>
              </div>
              <input 
                type="range" min="15" max="100" value={windSpeed} 
                onChange={(e) => setWindSpeed(Number(e.target.value))}
                className="w-full accent-teal-500 h-1 bg-slate-700 rounded-lg cursor-pointer"
              />
            </div>
            
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-300 flex items-center gap-1.5 font-medium">
                  <Activity size={14} className="text-slate-400" /> Coastal Storm Surge
                </span>
                <span className="font-bold text-white bg-slate-800 px-2 py-0.5 rounded-md border border-slate-700">{slrMeters.toFixed(1)}m</span>
              </div>
              <input 
                type="range" min="0.0" max="3.0" step="0.5" value={slrMeters} 
                onChange={(e) => setSlrMeters(parseFloat(e.target.value))}
                className="w-full accent-teal-500 h-1 bg-slate-700 rounded-lg cursor-pointer"
              />
            </div>
          </div>

          {/* AI Intake Reporting Hub */}
          <div className="p-4 rounded-2xl bg-slate-800/30 border border-slate-800/60 flex flex-col gap-3">
            <div className="flex items-center gap-2 pb-1 border-b border-slate-800">
              <FileText size={14} className="text-teal-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">Emergency Situation Report</h3>
            </div>
            
            <form onSubmit={handleIncidentPipelineSubmit} className="flex flex-col gap-3">
              <textarea 
                value={incidentText}
                onChange={(e) => setIncidentText(e.target.value)}
                placeholder="Describe current location damage or grid failures here..."
                className="w-full h-20 bg-slate-900/60 focus:bg-slate-900 border border-slate-700/60 focus:border-teal-500/80 rounded-xl text-slate-200 text-sm p-3 focus:outline-none transition-all placeholder:text-slate-500 resize-none"
              />
              <div className="flex items-center justify-between gap-2 bg-slate-900/40 p-2 rounded-xl border border-slate-800">
                <span className="text-xs text-slate-400 pl-1">Attach Drone Photo:</span>
                <input 
                  type="file" accept="image/*" 
                  onChange={(e) => setSelectedImage(e.target.files[0])} 
                  className="text-xs text-slate-400 file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-800 file:text-slate-200 file:hover:bg-slate-700 file:cursor-pointer max-w-[180px]" 
                />
              </div>
              <button 
                type="submit" 
                disabled={loadingPipeline} 
                className="w-full bg-teal-500 hover:bg-teal-400 disabled:bg-slate-800 text-slate-950 font-bold py-2.5 px-4 rounded-xl transition-all duration-150 text-xs shadow-md shadow-teal-500/10 active:scale-[0.99]"
              >
                {loadingPipeline ? "ANALYZING REPROT INTERRUPT..." : "Submit Report to AI Triage"}
              </button>
            </form>
          </div>

          {/* AI Response Output Card */}
          {playbookResult && (
            <div className="p-4 rounded-2xl bg-teal-500/5 border border-teal-500/20 shadow-md animate-fadeIn flex flex-col gap-2.5">
              <div className="flex items-center gap-2 text-teal-400">
                <CheckCircle2 size={16} />
                <h4 className="text-xs font-bold uppercase tracking-wider">Tactical Action Directives</h4>
              </div>
              <p className="text-sm text-slate-200 font-medium leading-relaxed">{playbookResult.actionable_tactical_playbook}</p>
              <div className="grid grid-cols-2 gap-2 mt-1 pt-2 border-t border-slate-800/60 text-[11px] text-slate-400">
                <div><span className="text-slate-500">Triage Profile:</span> <span className="text-slate-300 font-medium">{playbookResult.triage_incident_profile}</span></div>
                <div><span className="text-slate-500">Visual Feed:</span> <span className="text-slate-300 font-medium">{playbookResult.visual_verification}</span></div>
              </div>
            </div>
          )}

          {/* Real-time Infrastructure Monitoring Tree */}
          <div className="p-4 rounded-2xl bg-slate-800/30 border border-slate-800/60 flex flex-col gap-3 min-h-[160px]">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Local Infrastructure Status</h4>
            <div className="flex flex-col gap-2.5 divide-y divide-slate-800/40">
              {gridData?.assets?.map(asset => {
                const isDown = asset.status.includes('DOWN');
                const isIslanded = asset.status.includes('ISLANDED');
                return (
                  <div key={asset.id} className="pt-2.5 first:pt-0 flex justify-between items-start gap-4">
                    <div>
                      <div className="text-sm font-semibold text-white">{asset.name}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">Vector: {asset.power_routing}</div>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase border tracking-wide whitespace-nowrap ${
                      isDown ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : 
                      isIslanded ? 'bg-sky-500/10 text-sky-400 border-sky-500/20' : 
                      'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    }`}>
                      {isDown ? 'Offline' : isIslanded ? 'Isolated' : 'Normal'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

        </div>

        {/* 🗺️ Interactive Map Panel (Takes remaining space, full height on mobile if selected) */}
        <div className={`flex-1 relative h-full min-h-[350px] md:min-h-0 ${
          activeTab === 'map' ? 'block' : 'hidden md:block'
        }`}>
          <Map 
            {...viewState} 
            onMove={evt => setViewState(evt.viewState)} 
            mapStyle="mapbox://styles/mapbox/dark-v11" 
            mapboxAccessToken={MAPBOX_TOKEN}
          >
            {floodGeoJson && (
              <Source id="flood" type="geojson" data={floodGeoJson}>
                <Layer type="fill" paint={{ 'fill-color': '#f43f5e', 'fill-opacity': 0.25 }} />
              </Source>
            )}
            
            {gridData?.assets?.map(asset => (
              <Marker key={asset.id} latitude={asset.coordinates[1]} longitude={asset.coordinates[0]}>
                <div 
                  className={`w-4 h-4 rounded-full border-2 border-white shadow-lg cursor-pointer transform transition-transform hover:scale-125 ${
                    asset.status.includes('DOWN') ? 'bg-rose-500 ring-4 ring-rose-500/20' : 
                    asset.status.includes('ISLANDED') ? 'bg-sky-400 ring-4 ring-sky-400/20' : 
                    'bg-emerald-500 ring-4 ring-emerald-500/20'
                  }`}
                  title={asset.name}
                />
              </Marker>
            ))}
          </Map>
        </div>

        {/* 📱 Mobile Sticky Sub-Navigation Bar (Only renders on small devices) */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-slate-900 border-t border-slate-800 flex z-50">
          <button 
            onClick={() => setActiveTab('controls')}
            className={`flex-1 flex flex-col items-center justify-center gap-1 text-xs font-semibold ${
              activeTab === 'controls' ? 'text-teal-400 bg-slate-800/30' : 'text-slate-400'
            }`}
          >
            <Sliders size={18} />
            <span>Dashboard</span>
          </button>
          <button 
            onClick={() => setActiveTab('map')}
            className={`flex-1 flex flex-col items-center justify-center gap-1 text-xs font-semibold ${
              activeTab === 'map' ? 'text-teal-400 bg-slate-800/30' : 'text-slate-400'
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