import React, { useState, useEffect } from 'react';
import Map, { Source, Layer, Marker } from 'react-map-gl';
import { Wind, Activity, Volume2, Users, HardHat, Waves } from 'lucide-react';
import 'mapbox-gl/dist/mapbox-gl.css';

const MAPBOX_TOKEN = 'YOUR_MAPBOX_ACCESS_TOKEN';

export default function App() {
  const [viewState, setViewState] = useState({ latitude: 17.96, longitude: -76.79, zoom: 9 }); // Initialized to show Caribbean tracking sandbox
  const [isMutualAidMode, setIsMutualAidMode] = useState(false);
  const [windSpeed, setWindSpeed] = useState(25);
  const [gridData, setGridData] = useState(null);
  const [oceanData, setOceanData] = useState(null);
  const [routingGeoJson, setRoutingGeoJson] = useState(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  // Fetch Ocean Telemetry Layers
  useEffect(() => {
    fetch('http://127.0.0.1:8000/api/v1/ocean/telemetry')
      .then(res => res.json()).then(data => setOceanData(data));
  }, []);

  // Fetch Grid & Energy Status 
  useEffect(() => {
    fetch(`http://127.0.0.1:8000/api/v1/resilience/simulate-grid?wind_speed_mph=${windSpeed}`)
      .then(res => res.json()).then(data => setGridData(data));
  }, [windSpeed]);

  // Fetch Spatial Logistic Routing Data
  useEffect(() => {
    fetch('http://127.0.0.1:8000/api/v1/mutual-aid/routes')
      .then(res => res.json()).then(data => setRoutingGeoJson(data));
  }, [isMutualAidMode]);

  // Adjust map viewport perspective depending on mode selected
  const handleModeSwitch = () => {
    if (!isMutualAidMode) {
      // Transition map focus back to NYC to display urban mutual aid routing
      setViewState({ latitude: 40.73, longitude: -73.93, zoom: 10 });
    } else {
      // Transition back to macro ocean tracking environment
      setViewState({ latitude: 17.96, longitude: -76.79, zoom: 9 });
    }
    setIsMutualAidMode(!isMutualAidMode);
  };

  const routeLineStyle = {
    id: 'route-lines', type: 'line',
    paint: { 'line-color': '#38bdf8', 'line-width': 4, 'line-dasharray': [2, 2] }
  };

  const triggerTTSAlert = () => {
    setIsPlayingAudio(true);
    const msg = isMutualAidMode 
      ? "Emergency response active. Directing validated food surpluses to localized shelters."
      : "Parsing marine thermal datasets. Critical environmental indicators loaded. Automated utility safeguards operational.";
    const utterance = new SpeechSynthesisUtterance(msg);
    utterance.onend = () => setIsPlayingAudio(false);
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div style={{ fontFamily: 'sans-serif', backgroundColor: '#0f172a', color: '#fff', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{ padding: '14px 20px', borderBottom: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#0f172a' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Activity color={isMutualAidMode ? "#38bdf8" : "#00ffcc"} />
          <h1 style={{ fontSize: '15px', margin: 0, fontWeight: 800 }}>AURA // ECOSYSTEM ORCHESTRATION PLATFORM</h1>
        </div>
        <button 
          onClick={handleModeSwitch}
          style={{ backgroundColor: isMutualAidMode ? '#38bdf8' : '#1e293b', color: isMutualAidMode ? '#0f172a' : '#fff', border: '1px solid #38bdf8', padding: '6px 14px', borderRadius: '20px', fontWeight: 'bold', cursor: 'pointer' }}
        >
          {isMutualAidMode ? "Switch to Ocean/Grid View" : "Activate Mutual Aid Mode"}
        </button>
      </header>

      <div style={{ flex: 1, display: 'flex', flexDirection: window.innerWidth < 768 ? 'column' : 'row' }}>
        {/* Geospatial Map */}
        <div style={{ flex: 1, position: 'relative', minHeight: '400px' }}>
          <Map {...viewState} onMove={evt => setViewState(evt.viewState)} mapStyle="mapbox://styles/mapbox/dark-v11" mapboxAccessToken={MAPBOX_TOKEN}>
            {/* Draw active mutual aid routing lines if mode is enabled */}
            {isMutualAidMode && routingGeoJson && (
              <Source id="mutual-aid-routes" type="geojson" data={routingGeoJson}><Layer {...routeLineStyle} /></Source>
            )}

            {/* Display Ocean Anomaly Clusters dynamically */}
            {!isMutualAidMode && oceanData?.features?.map((feat, i) => (
              <Marker key={i} latitude={feat.geometry.coordinates[1]} longitude={feat.geometry.coordinates[0]}>
                <div style={{ width: '18px', height: '18px', background: 'rgba(239, 68, 68, 0.4)', borderRadius: '50%', border: '2px solid #ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title={feat.properties.location_name}>
                  <Waves size={10} color="#ef4444" />
                </div>
              </Marker>
            ))}

            {/* Always display infrastructure asset pins */}
            {gridData?.nodes?.map(node => (
              <Marker key={node.id} latitude={node.lat} longitude={node.lng}>
                <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: node.status.includes('COLLAPSED') ? '#ef4444' : isMutualAidMode ? '#38bdf8' : '#22c55e', border: '1px solid #fff' }} />
              </Marker>
            ))}
          </Map>
        </div>

        {/* Dynamic Context Control Sidebar */}
        <div style={{ width: window.innerWidth < 768 ? '100%' : '360px', padding: '20px', backgroundColor: '#0f172a', borderLeft: '1px solid #334155', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '15px' }}>
          
          {!isMutualAidMode ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* OCEAN OBSERVATORY MODULE */}
              <div style={{ backgroundColor: '#0b2545', padding: '14px', borderRadius: '8px', border: '1px solid #134074' }}>
                <h3 style={{ margin: '0 0 6px 0', fontSize: '13px', color: '#64dfdf', display: 'flex', alignItems: 'center', gap: '6px' }}><Waves size={16} /> SATELLITE TELEMETRY</h3>
                <span style={{ fontSize: '11px', color: '#94a3b8' }}>Ingesting NASA PO.DAAC Sea Surface Thermal Profiles & Microplastic Coordinates.</span>
              </div>
              
              {/* UTILITY ORCHESTRATOR SUB-MODULE */}
              <div style={{ backgroundColor: '#1e293b', padding: '14px', borderRadius: '8px', border: '1px solid #334155' }}>
                <h3 style={{ margin: '0 0 6px 0', fontSize: '13px', color: '#00ffcc', display: 'flex', alignItems: 'center', gap: '6px' }}><Wind size={16} /> WIND ORCHESTRATION</h3>
                <label style={{ fontSize: '12px' }}>Current Kinetic Vector: <strong>{windSpeed} MPH</strong></label>
                <input type="range" min="15" max="100" value={windSpeed} onChange={(e) => setWindSpeed(Number(e.target.value))} style={{ width: '100%', margin: '8px 0' }} />
              </div>
            </div>
          ) : (
            <div style={{ backgroundColor: '#0f2d2b', padding: '16px', borderRadius: '8px', border: '1px solid #114b43' }}>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '13px', color: '#4ade80', display: 'flex', alignItems: 'center', gap: '6px' }}><Users size={16} /> CIVIC MUTUAL AID</h3>
              <p style={{ fontSize: '12px', color: '#cbd5e1', margin: 0 }}>Translating real-time hazard impacts into human safety alerts and optimizing immediate localized resource pipelines.</p>
            </div>
          )}

          <button onClick={triggerTTSAlert} style={{ width: '100%', backgroundColor: '#0284c7', border: 'none', padding: '12px', borderRadius: '6px', color: '#fff', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <Volume2 size={16} /> Synthesize Audio Alert
          </button>

          {/* Engine Logs Console */}
          <div style={{ background: '#111827', padding: '14px', borderRadius: '8px', border: '1px solid #1e293b', flex: 1 }}>
            <h4 style={{ margin: '0 0 10px 0', fontSize: '11px', color: '#64748b', letterSpacing: '0.5px' }}><HardHat size={12} /> TELEMETRY LOG PIPELINE</h4>
            <div style={{ fontSize: '11px', lineHeight: '1.6', color: '#e2e8f0' }}>
              <div>System Mode: <strong>{isMutualAidMode ? "CIVIC DISPATCH" : "ENVIRONMENTAL SANDBOX"}</strong></div>
              <hr style={{ borderColor: '#1e293b', margin: '8px 0' }} />
              {gridData?.nodes?.map(n => (
                <div key={n.id} style={{ marginBottom: '6px' }}>
                  <div style={{ color: '#94a3b8', fontWeight: 600 }}>{n.name}</div>
                  <div style={{ color: n.status.includes('ISLANDED') ? '#38bdf8' : n.status.includes('COLLAPSED') ? '#f87171' : '#4ade80' }}>{n.status}</div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}