import React, { useState, useEffect } from 'react';
import Map, { Source, Layer, Marker } from 'react-map-gl';
import { Wind, Activity, Volume2, HardHat, Waves, ShieldAlert, Zap, Radio, Image } from 'lucide-react';
import 'mapbox-gl/dist/mapbox-gl.css';

const MAPBOX_TOKEN = 'YOUR_MAPBOX_ACCESS_TOKEN';

export default function App() {
  const [viewState, setViewState] = useState({ latitude: 17.96, longitude: -76.79, zoom: 9.5 });
  const [windSpeed, setWindSpeed] = useState(25);
  const [slrMeters, setSlrMeters] = useState(0.0);
  const [gridData, setGridData] = useState(null);
  const [oceanData, setOceanData] = useState(null);
  const [floodGeoJson, setFloodGeoJson] = useState(null);
  const [activeOutputKw, setActiveOutputKw] = useState(0);

  // Aura New State Matrices
  const [airGapped, setAirGapped] = useState(false);
  const [incidentText, setIncidentText] = useState("");
  const [selectedImage, setSelectedImage] = useState(null);
  const [playbookResult, setPlaybookResult] = useState(null);
  const [loadingPipeline, setLoadingPipeline] = useState(false);
  const [activeThreatIndex, setActiveThreatIndex] = useState(null);

  useEffect(() => {
    fetch('http://127.0.0.1:8000/api/v1/ocean/telemetry').then(res => res.json()).then(data => setOceanData(data));
  }, []);

  // Sync grid simulator with both sliders and GNN targeted threat indices
  useEffect(() => {
    let url = `http://127.0.0.1:8000/api/v1/resilience/simulate-grid?wind_speed_mph=${windSpeed}`;
    if (activeThreatIndex !== null) {
      url += `&threat_index=${activeThreatIndex}`;
    }
    fetch(url)
      .then(res => res.json())
      .then(data => {
        setGridData(data);
        setActiveOutputKw(data.calculated_der_output_kw);
      });
  }, [windSpeed, activeThreatIndex]);

  useEffect(() => {
    fetch(`http://127.0.0.1:8000/api/v1/hazard/inundation?slr_meters=${slrMeters}`).then(res => res.json()).then(data => setFloodGeoJson(data));
  }, [slrMeters]);

  const triggerResilientOrchestrationStory = () => {
    setWindSpeed(78);
    setSlrMeters(2.0);
    executeVoiceBroadcast("Warning: Main transmission feeds compromised by surge forces. Aura platform activating local autonomous microgrid isolation loops.");
  };

  const handleIncidentPipelineSubmit = (e) => {
    e.preventDefault();
    setLoadingPipeline(true);
    
    const formData = new FormData();
    formData.append("text", incidentText);
    formData.append("air_gapped", airGapped.toString());
    formData.append("wind_speed", windSpeed.toString());
    if (selectedImage) {
      formData.append("image", selectedImage);
    }

    fetch('http://127.0.0.1:8000/api/v1/voice/report', {
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
      executeVoiceBroadcast(`Tactical triage completed. Hazard type detected: ${data.triage_incident_profile}`);
    })
    .catch(() => setLoadingPipeline(false));
  };

  const executeVoiceBroadcast = (text) => {
    if (airGapped) {
      // Local air gapped browser voice synthesizer
      window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
      return;
    }
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
          <h1 style={{ fontSize: '14px', margin: 0, fontWeight: 800 }}>AURA // MULTI-MODAL SELF-HEALING ENGINE</h1>
        </div>

        {/* Air-Gapped Mode Switch */}
        <button 
          onClick={() => setAirGapped(!airGapped)}
          style={{
            backgroundColor: airGapped ? '#f59e0b' : '#334155',
            color: '#fff', border: 'none', padding: '8px 14px', borderRadius: '4px',
            fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
          }}
        >
          <Radio size={14} /> {airGapped ? "MODE: AIR-GAPPED ACTIVE" : "MODE: INTERNET HYBRID"}
        </button>
      </header>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'row' }}>
        {/* Map Canvas */}
        <div style={{ flex: 1, position: 'relative', minHeight: '400px' }}>
          <Map {...viewState} onMove={evt => setViewState(evt.viewState)} mapStyle="mapbox://styles/mapbox/dark-v11" mapboxAccessToken={MAPBOX_TOKEN}>
            {floodGeoJson && <Source id="flood" type="geojson" data={floodGeoJson}><Layer type="fill" paint={{ 'fill-color': '#ef4444', 'fill-opacity': 0.35 }} /></Source>}
            
            {gridData?.assets?.map(asset => (
              <Marker key={asset.id} latitude={asset.coordinates[1]} longitude={asset.coordinates[0]}>
                <div 
                  style={{
                    width: '16px', height: '16px', borderRadius: '50%',
                    background: asset.status.includes('DOWN') ? '#ef4444' : asset.status.includes('ISLANDED') ? '#38bdf8' : '#22c55e',
                    border: '2px solid #fff', boxShadow: '0 0 12px rgba(255,255,255,0.6)'
                  }} 
                  title={asset.name}
                />
              </Marker>
            ))}
          </Map>
        </div>

        {/* Sidebar Controls Panel */}
        <div style={{ width: '400px', padding: '20px', backgroundColor: '#0f172a', borderLeft: '1px solid #334155', display: 'flex', flexDirection: 'column', gap: '15px', overflowY: 'auto' }}>
          
          <button onClick={triggerResilientOrchestrationStory} style={{ width: '100%', backgroundColor: '#ef4444', border: 'none', padding: '12px', borderRadius: '6px', color: '#fff', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <ShieldAlert size={18} /> Simulate Hurricane Landing
          </button>

          {/* GNN Generation Matrices Panel */}
          <div style={{ backgroundColor: '#0b2545', padding: '14px', borderRadius: '8px', border: '1px solid #134074' }}>
            <h3 style={{ margin: '0 0 4px 0', fontSize: '11px', color: '#64dfdf' }}>⚡ RESILIENT GENERATION MATRICES</h3>
            <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#38bdf8' }}>{activeOutputKw} kW Generated</div>
          </div>

          {/* Sliders */}
          <div style={{ backgroundColor: '#1e293b', padding: '12px', borderRadius: '8px', border: '1px solid #334155', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '11px', color: '#94a3b8' }}><Wind size={12} /> Kinetic Wind Feed: <strong>{windSpeed} MPH</strong></label>
            <input type="range" min="15" max="100" value={windSpeed} onChange={(e) => setWindSpeed(Number(e.target.value))} />
            
            <label style={{ fontSize: '11px', color: '#94a3b8' }}><Waves size={12} /> Coastal Inundation Bounds: <strong>{slrMeters}m</strong></label>
            <input type="range" min="0.0" max="3.0" step="0.5" value={slrMeters} onChange={(e) => setSlrMeters(parseFloat(e.target.value))} />
          </div>

          {/* AI Telemetry Ingestion Input Form */}
          <div style={{ backgroundColor: '#111827', padding: '14px', borderRadius: '8px', border: '1px solid #1e293b' }}>
            <h4 style={{ margin: '0 0 8px 0', fontSize: '11px', color: '#38bdf8' }}>🛰️ INCIDENT DATA INGESTION MATRIX</h4>
            <form onSubmit={handleIncidentPipelineSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <textarea 
                value={incidentText}
                onChange={(e) => setIncidentText(e.target.value)}
                placeholder="Type field report or incident details (e.g., Palisadoes transmission broken)..."
                style={{ width: '100%', height: '50px', background: '#1e293b', border: '1px solid #334155', borderRadius: '4px', color: '#fff', fontSize: '11px', padding: '6px', boxSizing: 'border-box' }}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input type="file" accept="image/*" onChange={(e) => setSelectedImage(e.target.files[0])} style={{ fontSize: '10px', color: '#94a3b8' }} />
              </div>
              <button type="submit" disabled={loadingPipeline} style={{ background: '#00ffcc', color: '#0f172a', fontWeight: 'bold', padding: '8px', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>
                {loadingPipeline ? "PROCESSING PIPELINE INFERENCE..." : "EXECUTE MULTI-MODAL TRIAGE"}
              </button>
            </form>
          </div>

          {/*AI Playbook Results Terminal Display */}
          {playbookResult && (
            <div style={{ background: '#022329', padding: '14px', borderRadius: '8px', border: '1px solid #004b49' }}>
              <h4 style={{ margin: '0 0 6px 0', fontSize: '11px', color: '#00ffcc' }}>📋 GENERATED TACTICAL RESCUE PLAYBOOK</h4>
              <p style={{ fontSize: '11px', color: '#e2e8f0', margin: '0 0 8px 0', lineHeight: '1.5' }}>{playbookResult.actionable_tactical_playbook}</p>
              <div style={{ fontSize: '10px', color: '#829ab1' }}>
                <div><strong>Triage Analysis:</strong> {playbookResult.triage_incident_profile}</div>
                <div><strong>Visual Check:</strong> {playbookResult.visual_verification}</div>
                <div><strong>Execution Fabric:</strong> {playbookResult.system_execution_profile}</div>
              </div>
            </div>
          )}

          {/* Microgrid Routing Logs Displaying GNN Output Status */}
          <div style={{ background: '#111827', padding: '14px', borderRadius: '8px', border: '1px solid #1e293b', flex: 1, overflowY: 'auto' }}>
            <h4 style={{ margin: '0 0 8px 0', fontSize: '11px', color: '#64748b' }}><HardHat size={12} /> MICROGRID TOPO STABILITY MATRIX LOGS</h4>
            <div style={{ fontSize: '11px', lineHeight: '1.6' }}>
              {gridData?.assets?.map(asset => (
                <div key={asset.id} style={{ marginBottom: '8px', borderBottom: '1px solid #1e293b', paddingBottom: '4px' }}>
                  <div style={{ color: '#e2e8f0', fontWeight: 600 }}>{asset.name}</div>
                  <div style={{ fontSize: '10px', color: asset.status.includes('CRITICAL') ? '#ef4444' : asset.status.includes('ISLANDED') ? '#38bdf8' : '#4ade80' }}>{asset.status}</div>
                  <div style={{ fontSize: '10px', color: '#64748b' }}>Routing Vector: {asset.power_routing}</div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}