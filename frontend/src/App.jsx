import React, { useState, useEffect, useRef} from 'react';
import Map, { Source, Layer, Marker } from 'react-map-gl';
import { 
  Wind, Activity, Volume2, ShieldAlert, Zap, Radio, 
  Map as MapIcon, Sliders, AlertTriangle, FileText, CheckCircle2 
} from 'lucide-react';
import 'mapbox-gl/dist/mapbox-gl.css';

const MAPBOX_TOKEN = 'pk.eyJ1IjoiYXN0YXlsb3IxMTQxMyIsImEiOiJjbXB1cmpydmMxd3BuMnNwejZpaWo5ejExIn0.kxy1wEs_hpg5ZYB-2Z3daw';
const BACKEND_API_BASE = "https://aura-resilience-platform-qa.onrender.com/";

const STYLES = {
  wrapper: { fontFamily: 'system-ui, -apple-system, sans-serif', backgroundColor: '#f8fafc', color: '#334155', minHeight: '100vh', display: 'flex', flexDirection: 'column' },
  header: { padding: '14px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#ffffff', boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)' },
  logoBox: { padding: '8px', backgroundColor: '#eef2f6', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  mainBody: { flex: 1, display: 'flex', flexDirection: 'row', relative: 'true', overflow: 'hidden' },
  
  // Controls Dashboard Layout Panel
  panel: { width: '420px', padding: '24px', backgroundColor: '#ffffff', borderRight: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '20px', overflowY: 'auto', boxSizing: 'border-box', flexShrink: 0 },
  
  // Interactive UI Cards
  btnDanger: { width: '100%', backgroundColor: '#e11d48', border: 'none', padding: '14px', borderRadius: '12px', color: '#ffffff', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '14px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' },
  btnSubmit: { width: '100%', backgroundColor: '#4f46e5', color: '#ffffff', fontWeight: '700', padding: '12px', border: 'none', borderRadius: '12px', cursor: 'pointer', fontSize: '13px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' },
  cardMetric: { padding: '16px', borderRadius: '16px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' },
  cardSection: { padding: '16px', borderRadius: '16px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '14px' },
  cardDirective: { padding: '16px', borderRadius: '16px', backgroundColor: '#f0fdf4', border: '1px solid #dcfce7', animation: 'fadeIn 0.3s ease' },
  
  // Inputs & Badges
  textarea: { width: '100%', height: '80px', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '12px', color: '#1e293b', fontSize: '13px', padding: '12px', boxSizing: 'border-box', outline: 'none', transition: 'all 0.2s', resize: 'none' },
  fileRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', backgroundColor: '#ffffff', padding: '8px 12px', borderRadius: '12px', border: '1px solid #e2e8f0' },
  badgeStatus: (type) => ({
    fontSize: '11px', padding: '4px 10px', borderRadius: '9999px', fontWeight: '700', textTransform: 'uppercase', border: '1px solid',
    backgroundColor: type === 'DOWN' ? '#fff1f2' : type === 'ISLANDED' ? '#f0f9ff' : '#f0fdf4',
    color: type === 'DOWN' ? '#e11d48' : type === 'ISLANDED' ? '#0284c7' : '#16a34a',
    borderColor: type === 'DOWN' ? '#fecdd3' : type === 'ISLANDED' ? '#bae6fd' : '#bbf7d0'
  })
};

export default function App() {
  const mapRef = useRef(null);
  const [viewState, setViewState] = useState({ latitude: 17.96, longitude: -76.79, zoom: 9.2 });
  const [windSpeed, setWindSpeed] = useState(25);
  const [slrMeters, setSlrMeters] = useState(0.0);
  const [gridData, setGridData] = useState(null);
  const [floodGeoJson, setFloodGeoJson] = useState(null);
  const [activeOutputKw, setActiveOutputKw] = useState(0);

  // Aura State Pipeline Matrices
  const [airGapped, setAirGapped] = useState(false);
  const [incidentText, setIncidentText] = useState("");
  const [selectedImage, setSelectedImage] = useState(null);
  const [playbookResult, setPlaybookResult] = useState(null);
  const [loadingPipeline, setLoadingPipeline] = useState(false);
  const [activeThreatIndex, setActiveThreatIndex] = useState(null);
  
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
      .catch(err => console.error("Grid Link Error:", err));
  }, [windSpeed, activeThreatIndex]);

  useEffect(() => {
    fetch(`${BACKEND_API_BASE}/api/v1/hazard/inundation?slr_meters=${slrMeters}`)
      .then(res => res.json())
      .then(data => setFloodGeoJson(data))
      .catch(err => console.error("Inundation Link Error:", err));
  }, [slrMeters]);

  useEffect(() => {
    if (mapRef.current) {
      setTimeout(() => {
        mapRef.current.getMap().resize();
      }, 100); // Small 100ms delay gives the browser time to paint the layout first
    }
  }, [gridData, activeTab]);

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
    <div style={STYLES.wrapper}>
      {/* Top Navigation Bar */}
      <header style={STYLES.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={STYLES.logoBox}>
            <Zap style={{ color: '#4f46e5' }} size={20} />
          </div>
          <div>
            <h1 style={{ fontSize: '16px', margin: 0, fontWeight: 700, color: '#0f172a' }}>Aura Resilience</h1>
            <p style={{ fontSize: '12px', margin: '2px 0 0 0', color: '#64748b', fontWeight: 500 }}>Community Disaster Response Dashboard</p>
          </div>
        </div>

        <button 
          onClick={() => setAirGapped(!airGapped)}
          style={{
            backgroundColor: airGapped ? '#fef3c7' : '#f1f5f9',
            color: airGapped ? '#b45309' : '#475569',
            border: `1px solid ${airGapped ? '#fde68a' : '#cbd5e1'}`,
            padding: '8px 16px', borderRadius: '12px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s'
          }}
        >
          <Radio size={14} style={{ color: airGapped ? '#d97706' : '#64748b' }} />
          <span>{airGapped ? "Air-Gapped Local" : "Cloud Synchronized"}</span>
        </button>
      </header>

      {/* Main Container Workspace */}
      <div style={{ flex: 1, display: 'flex', flexDirection: window.innerWidth > 768 ? 'row' : 'column', overflow: 'hidden', position: 'relative' }}>
        
        {/* Left Side Menu Controls Dashboard (Always visible on desktop screens) */}
        <div style={{ ...STYLES.panel, display: activeTab === 'controls' || window.innerWidth > 768 ? 'flex' : 'none' }}>
          
          <button onClick={triggerResilientOrchestrationStory} style={STYLES.btnDanger}>
            <ShieldAlert size={18} /> <span>Simulate Hurricane Impact</span>
          </button>

          <div style={STYLES.cardMetric}>
            <span style={{ fontSize: '10px', fontWeight: '700', color: '#16a34a', display: 'block', marginBottom: '4px', letterSpacing: '0.05em' }}>BACKUP GENERATION OUTPUT</span>
            <div style={{ fontSize: '24px', fontWeight: '800', color: '#16a34a' }}>
              {activeOutputKw.toLocaleString()} <span style={{ fontSize: '14px', fontWeight: '500', color: '#475569' }}>kW Active</span>
            </div>
          </div>

          {/* Sliders Configuration Block */}
          <div style={STYLES.cardSection}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
                <span style={{ color: '#475569', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '500' }}>
                  <Wind size={14} style={{ color: '#94a3b8' }} /> Sustained Wind Speed
                </span>
                <span style={{ fontWeight: '700', color: '#0f172a', backgroundColor: '#ffffff', padding: '2px 8px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>{windSpeed} MPH</span>
              </div>
              <input type="range" min="15" max="100" value={windSpeed} onChange={(e) => setWindSpeed(Number(e.target.value))} style={{ width: '100%', cursor: 'pointer' }} />
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
                <span style={{ color: '#475569', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '500' }}>
                  <Activity size={14} style={{ color: '#94a3b8' }} /> Coastal Storm Surge
                </span>
                <span style={{ fontWeight: '700', color: '#0f172a', backgroundColor: '#ffffff', padding: '2px 8px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>{slrMeters.toFixed(1)}m</span>
              </div>
              <input type="range" min="0.0" max="3.0" step="0.5" value={slrMeters} onChange={(e) => setSlrMeters(parseFloat(e.target.value))} style={{ width: '100%', cursor: 'pointer' }} />
            </div>
          </div>

          {/* Ingestion Report Form */}
          <div style={STYLES.cardSection}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid #e2e8f0', paddingBottom: '6px' }}>
              <FileText size={14} style={{ color: '#4f46e5' }} />
              <h3 style={{ fontSize: '11px', fontWeight: '700', margin: 0, color: '#475569', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Emergency Situation Report</h3>
            </div>
            
            <form onSubmit={handleIncidentPipelineSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <textarea 
                value={incidentText} onChange={(e) => setIncidentText(e.target.value)}
                placeholder="Describe current location damage or grid failures here..."
                style={STYLES.textarea}
              />
              <div style={STYLES.fileRow}>
                <span style={{ fontSize: '12px', color: '#64748b' }}>Attach Drone Photo:</span>
                <input type="file" accept="image/*" onChange={(e) => setSelectedImage(e.target.files[0])} style={{ fontSize: '12px', color: '#64748b', maxWidth: '180px' }} />
              </div>
              <button type="submit" disabled={loadingPipeline} style={STYLES.btnSubmit}>
                {loadingPipeline ? "PROCESSING PIPELINE INFERENCE..." : "Submit Report to AI Triage"}
              </button>
            </form>
          </div>

          {playbookResult && (
            <div style={STYLES.cardDirective}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#16a34a', marginBottom: '8px' }}>
                <CheckCircle2 size={16} />
                <h4 style={{ fontSize: '11px', fontWeight: '700', margin: 0, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Tactical Action Directives</h4>
              </div>
              <p style={{ fontSize: '14px', color: '#1e293b', fontWeight: '600', margin: '0 0 10px 0', lineHeight: '1.5' }}>{playbookResult.actionable_tactical_playbook}</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', paddingTop: '8px', borderTop: '1px solid #e2e8f0', fontSize: '11px', color: '#64748b' }}>
                <div>Triage: <span style={{ color: '#1e293b', fontWeight: '600' }}>{playbookResult.triage_incident_profile}</span></div>
                <div>Visual: <span style={{ color: '#1e293b', fontWeight: '600' }}>{playbookResult.visual_verification}</span></div>
              </div>
            </div>
          )}

          {/* Infrastructure Health Tracker*/}
          <div style={STYLES.cardSection}>
            <h4 style={{ fontSize: '11px', fontWeight: '700', margin: '0 0 4px 0', color: '#64748b', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Local Infrastructure Status</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {gridData?.assets?.map(asset => {
                const isDown = asset.status.includes('DOWN');
                const isIslanded = asset.status.includes('ISLANDED');
                const statusType = isDown ? 'DOWN' : isIslanded ? 'ISLANDED' : 'NORMAL';
                return (
                  <div key={asset.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: '600', color: '#0f172a' }}>{asset.name}</div>
                      <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>Vector: {asset.power_routing}</div>
                    </div>
                    <span style={STYLES.badgeStatus(statusType)}>
                      {isDown ? 'Offline' : isIslanded ? 'Isolated' : 'Normal'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Side Interactive Mapbox Frame */}
        <div style={{ flex: 1, position: 'relative', height: 'calc(100vh - 73px)', display: activeTab === 'map' || window.innerWidth > 768 ? 'block' : 'none' }}>
          <Map 
            ref={mapRef}
            {...viewState} 
            onMove={evt => setViewState(evt.viewState)} 
            mapStyle="mapbox://styles/mapbox/dark-v11" 
            mapboxAccessToken={MAPBOX_TOKEN}
            style={{ width: '100%', height: '100%' }}
          >
            {floodGeoJson && (
              <Source id="flood" type="geojson" data={floodGeoJson}>
                <Layer type="fill" paint={{ 'fill-color': '#e11d48', 'fill-opacity': 0.25 }} />
              </Source>
            )}
            {gridData?.assets?.map(asset => (
              <Marker key={asset.id} latitude={asset.coordinates[1]} longitude={asset.coordinates[0]}>
                <div 
                  style={{
                    width: '16px', height: '16px', borderRadius: '50%',
                    backgroundColor: asset.status.includes('DOWN') ? '#e11d48' : asset.status.includes('ISLANDED') ? '#38bdf8' : '#16a34a',
                    border: '2px solid #ffffff', boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                  }}
                  title={asset.name}
                />
              </Marker>
            ))}
          </Map>
        </div>
      </div>

        {/* Mobile View Navigation Toggle Sticky footer */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-slate-200 flex z-50 shadow-lg">
          <button 
            onClick={() => setActiveTab('controls')}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px', border: 'none', background: activeTab === 'controls' ? '#f8fafc' : 'none', color: activeTab === 'controls' ? '#4f46e5' : '#94a3b8', cursor: 'pointer' }}
          >
            <Sliders size={18} /> <span style={{ fontSize: '11px', fontWeight: '600' }}>Dashboard</span>
          </button>
          <button 
            onClick={() => setActiveTab('map')}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px', border: 'none', background: activeTab === 'map' ? '#f8fafc' : 'none', color: activeTab === 'map' ? '#4f46e5' : '#94a3b8', cursor: 'pointer' }}
          >
            <MapIcon size={18} /> <span style={{ fontSize: '11px', fontWeight: '600' }}>Telemetry Map</span>
          </button>
        </div>

      </div>
    </div>
  );
}