import React, { useState, useEffect } from 'react';
import Map, { Source, Layer, Marker } from 'react-map-gl';
import { Wind, Activity, Volume2, HardHat, Waves, ShieldAlert, Zap } from 'lucide-react';
import 'mapbox-gl/dist/mapbox-gl.css';

const MAPBOX_TOKEN = 'YOUR_MAPBOX_ACCESS_TOKEN';

export default function App() {
  const [viewState, setViewState] = useState({ latitude: 17.96, longitude: -76.79, zoom: 9.5 });
  const [windSpeed, setWindSpeed] = useState(25);
  const [slrMeters, setSlrMeters] = useState(0.0);
  const [gridData, setGridData] = useState(null);
  const [oceanData, setOceanData] = useState(null);
  const [floodGeoJson, setFloodGeoJson] = useState(null);
  const [liveTranscription, setLiveTranscription] = useState("");
  const [activeOutputKw, setActiveOutputKw] = useState(0);

  useEffect(() => {
    fetch('http://127.0.0.1:8000/api/v1/ocean/telemetry').then(res => res.json()).then(data => setOceanData(data));
  }, []);

  useEffect(() => {
    fetch(`http://127.0.0.1:8000/api/v1/resilience/simulate-grid?wind_speed_mph=${windSpeed}`)
      .then(res => res.json())
      .then(data => {
        setGridData(data);
        setActiveOutputKw(data.calculated_der_output_kw);
      });
  }, [windSpeed]);

  useEffect(() => {
    fetch(`http://127.0.0.1:8000/api/v1/hazard/inundation?slr_meters=${slrMeters}`).then(res => res.json()).then(data => setFloodGeoJson(data));
  }, [slrMeters]);

  // The 30-Second Single-Tap "Story Mode" Trigger
  const triggerResilientOrchestrationStory = () => {
    setWindSpeed(78);
    setSlrMeters(2.0);
    executeVoiceBroadcast("Warning: Main transmission feeds compromised by surge forces. Aura platform activating local autonomous microgrid isolation loops. Resilient downwind turbine arrays online.");
  };

  const executeVoiceBroadcast = (text) => {
    fetch('http://127.0.0.1:8000/api/v1/voice/broadcast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: text })
    })
    .then(res => {
      if (res.headers.get("content-type") === "audio/mpeg") {
        res.blob().then(b => new Audio(URL.createObjectURL(b)).play());
      } else {
        window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
      }
    });
  };

  return (
    <div style={{ fontFamily: 'sans-serif', backgroundColor: '#0f172a', color: '#fff', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{ padding: '14px 20px', borderBottom: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#0f172a' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Zap color="#00ffcc" size={18} />
          <h1 style={{ fontSize: '14px', margin: 0, fontWeight: 800 }}>AURA // INFRASTRUCTURE SELF-HEALING ORCHESTRATOR</h1>
        </div>
      </header>

      <div style={{ flex: 1, display: 'flex', flexDirection: window.innerWidth < 768 ? 'column' : 'row' }}>
        {/* Map Canvas */}
        <div style={{ flex: 1, position: 'relative', minHeight: '400px' }}>
          <Map {...viewState} onMove={evt => setViewState(evt.viewState)} mapStyle="mapbox://styles/mapbox/dark-v11" mapboxAccessToken={MAPBOX_TOKEN}>
            {floodGeoJson && <Source id="flood" type="geojson" data={floodGeoJson}><Layer type="fill" paint={{ 'fill-color': '#ef4444', 'fill-opacity': 0.35 }} /></Source>}
            
            {/* Dynamic Utility Substation Rendering */}
            {gridData?.assets?.map(asset => (
              <Marker key={asset.id} latitude={asset.coordinates[1]} longitude={asset.coordinates[0]}>
                <div 
                  style={{
                    width: '14px', height: '14px', borderRadius: '50%',
                    background: asset.status.includes('DOWN') ? '#ef4444' : asset.status.includes('ISLANDED') ? '#38bdf8' : '#22c55e',
                    border: '2px solid #fff', boxShadow: '0 0 10px rgba(255,255,255,0.5)'
                  }} 
                  title={`${asset.name} - ${asset.status}`}
                />
              </Marker>
            ))}
          </Map>
        </div>

        {/* Sidebar Controls */}
        <div style={{ width: window.innerWidth < 768 ? '100%' : '360px', padding: '20px', backgroundColor: '#0f172a', borderLeft: '1px solid #334155', display: 'flex', flexDirection: 'column', gap: '15px', boxSizing: 'border-box' }}>
          
          <button onClick={triggerResilientOrchestrationStory} style={{ width: '100%', backgroundColor: '#ef4444', border: 'none', padding: '14px', borderRadius: '6px', color: '#fff', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <ShieldAlert size={18} /> Simulate Hurricane Landing
          </button>

          {/* Telemetry Harvest Matrix */}
          <div style={{ backgroundColor: '#0b2545', padding: '14px', borderRadius: '8px', border: '1px solid #134074' }}>
            <h3 style={{ margin: '0 0 4px 0', fontSize: '12px', color: '#64dfdf', display: 'flex', alignItems: 'center', gap: '6px' }}><Zap size={14} /> RESILIENT GENERATION MATRICES</h3>
            <div style={{ fontSize: '20px', fontWeight: 'bold', color: activeOutputKw > 0 ? '#38bdf8' : '#94a3b8', margin: '8px 0' }}>
              {activeOutputKw} kW Generated
            </div>
            <p style={{ fontSize: '11px', color: '#cbd5e1', margin: 0 }}>Tracking distributed kinetic harvesting from downwind flexible energy installations engineered for extreme vectors.</p>
          </div>

          {/* Control Vectors */}
          <div style={{ backgroundColor: '#1e293b', padding: '12px', borderRadius: '8px', border: '1px solid #334155', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '11px', color: '#94a3b8' }}><Wind size={12} /> Kinetic Wind Feed: <strong>{windSpeed} MPH</strong></label>
            <input type="range" min="15" max="100" value={windSpeed} onChange={(e) => setWindSpeed(Number(e.target.value))} style={{ width: '100%' }} />
            
            <label style={{ fontSize: '11px', color: '#94a3b8' }}><Waves size={12} /> Coastal Inundation Bounds: <strong>{slrMeters}m</strong></label>
            <input type="range" min="0.0" max="3.0" step="0.5" value={slrMeters} onChange={(e) => setSlrMeters(parseFloat(e.target.value))} style={{ width: '100%' }} />
          </div>

          {/* Live Infrastructure State Controller */}
          <div style={{ background: '#111827', padding: '14px', borderRadius: '8px', border: '1px solid #1e293b', flex: 1, overflowY: 'auto' }}>
            <h4 style={{ margin: '0 0 8px 0', fontSize: '11px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}><HardHat size={12} /> MICROGRID ROUTING MATRIX LOG</h4>
            <div style={{ fontSize: '11px', lineHeight: '1.6' }}>
              {gridData?.assets?.map(asset => (
                <div key={asset.id} style={{ marginBottom: '8px', borderBottom: '1px solid #1e293b', paddingBottom: '4px' }}>
                  <div style={{ color: '#e2e8f0', fontWeight: 600 }}>{asset.name}</div>
                  <div style={{ fontSize: '10px', color: asset.status.includes('CRITICAL') ? '#ef4444' : asset.status.includes('ISLANDED') ? '#38bdf8' : '#4ade80' }}>{asset.status}</div>
                  <div style={{ fontSize: '10px', color: '#64748b' }}>Route: {asset.power_routing}</div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}