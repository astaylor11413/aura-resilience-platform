import React, { useState, useEffect } from 'react';
import Map, { Source, Layer, Marker } from 'react-map-gl';
import { Wind, Activity, Volume2, Users, HardHat } from 'lucide-react';
import 'mapbox-gl/dist/mapbox-gl.css';

const MAPBOX_TOKEN = 'YOUR_MAPBOX_ACCESS_TOKEN'; // Set your Mapbox token here

export default function App() {
  const [viewState, setViewState] = useState({ latitude: 40.73, longitude: -73.93, zoom: 10 });
  const [isMutualAidMode, setIsMutualAidMode] = useState(false);
  const [windSpeed, setWindSpeed] = useState(25);
  const [gridData, setGridData] = useState(null);
  const [routingGeoJson, setRoutingGeoJson] = useState(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  useEffect(() => {
    fetch(`http://127.0.0.1:8000/api/v1/resilience/simulate-grid?wind_speed_mph=${windSpeed}`)
      .then(res => res.json()).then(data => setGridData(data));
  }, [windSpeed]);

  useEffect(() => {
    fetch('http://127.0.0.1:8000/api/v1/mutual-aid/routes')
      .then(res => res.json()).then(data => setRoutingGeoJson(data));
  }, [isMutualAidMode]);

  const routeLineStyle = {
    id: 'route-lines', type: 'line',
    paint: { 'line-color': '#38bdf8', 'line-width': 4, 'line-dasharray': [2, 2] }
  };

  const triggerTTSAlert = () => {
    setIsPlayingAudio(true);
    const msg = isMutualAidMode 
      ? "Mutual aid pipeline engaged. Routing restaurant inventory surpluses straight to regional centers."
      : "High-wind threat detected. Main lines compromised. Automated microgrids islanding facilities.";
    const utterance = new SpeechSynthesisUtterance(msg);
    utterance.onend = () => setIsPlayingAudio(false);
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div style={{ fontFamily: 'sans-serif', backgroundColor: '#0f172a', color: '#fff', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{ padding: '14px 20px', borderBottom: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#0f172a' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Activity color={isMutualAidMode ? "#38bdf8" : "#00ffcc"} />
          <h1 style={{ fontSize: '16px', margin: 0, fontWeight: 800 }}>AURA // CLIMATE ORCHESTRATOR</h1>
        </div>
        <button 
          onClick={() => setIsMutualAidMode(!isMutualAidMode)}
          style={{ backgroundColor: isMutualAidMode ? '#38bdf8' : '#1e293b', color: isMutualAidMode ? '#0f172a' : '#fff', border: '1px solid #38bdf8', padding: '6px 14px', borderRadius: '20px', fontWeight: 'bold', cursor: 'pointer' }}
        >
          {isMutualAidMode ? "Grid Mode" : "Mutual Aid Mode"}
        </button>
      </header>

      <div style={{ flex: 1, display: 'flex', flexDirection: window.innerWidth < 768 ? 'column' : 'row' }}>
        <div style={{ flex: 1, position: 'relative', minHeight: '400px' }}>
          <Map {...viewState} onMove={evt => setViewState(evt.viewState)} mapStyle="mapbox://styles/mapbox/dark-v11" mapboxAccessToken={MAPBOX_TOKEN}>
            {isMutualAidMode && routingGeoJson && (
              <Source id="mutual-aid-routes" type="geojson" data={routingGeoJson}><Layer {...routeLineStyle} /></Source>
            )}
            {gridData?.nodes?.map(node => (
              <Marker key={node.id} latitude={node.lat} longitude={node.lng}>
                <div style={{ width: '14px', height: '14px', borderRadius: '50%', background: node.status.includes('COLLAPSED') ? '#ef4444' : isMutualAidMode ? '#38bdf8' : '#22c55e', border: '2px solid #fff' }} />
              </Marker>
            ))}
          </Map>
        </div>

        <div style={{ width: window.innerWidth < 768 ? '100%' : '360px', padding: '20px', backgroundColor: '#0f172a', borderLeft: '1px solid #334155', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '15px' }}>
          {!isMutualAidMode ? (
            <div style={{ backgroundColor: '#1e293b', padding: '16px', borderRadius: '8px', border: '1px solid #334155' }}>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '13px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '6px' }}><Wind size={16} /> WIND MATRIX</h3>
              <label style={{ fontSize: '12px' }}>Simulation Bounds: <strong>{windSpeed} MPH</strong></label>
              <input type="range" min="15" max="100" value={windSpeed} onChange={(e) => setWindSpeed(Number(e.target.value))} style={{ width: '100%', margin: '10px 0' }} />
            </div>
          ) : (
            <div style={{ backgroundColor: '#0b2545', padding: '16px', borderRadius: '8px', border: '1px solid #134074' }}>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '13px', color: '#64dfdf', display: 'flex', alignItems: 'center', gap: '6px' }}><Users size={16} /> CIVIC PIPELINE</h3>
              <p style={{ fontSize: '12px', color: '#cbd5e1', margin: 0 }}>Matching supply nodes directly with shelters based on real-time capacity and location.</p>
            </div>
          )}

          <button onClick={triggerTTSAlert} style={{ width: '100%', backgroundColor: '#0284c7', border: 'none', padding: '12px', borderRadius: '6px', color: '#fff', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <Volume2 size={16} /> Synthesize Dispatch Alert
          </button>

          <div style={{ background: '#111827', padding: '14px', borderRadius: '8px', border: '1px solid #1e293b', flex: 1 }}>
            <h4 style={{ margin: '0 0 10px 0', fontSize: '11px', color: '#64748b', letterSpacing: '0.5px' }}><HardHat size={12} /> ENGINE LIVE LOGS</h4>
            <div style={{ fontSize: '12px', lineHeight: '1.5' }}>
              {gridData?.nodes?.map(n => (
                <div key={n.id} style={{ marginBottom: '6px' }}>
                  <div style={{ color: '#94a3b8' }}>{n.name}</div>
                  <div style={{ fontSize: '11px', color: n.status.includes('ISLANDED') ? '#38bdf8' : n.status.includes('COLLAPSED') ? '#f87171' : '#4ade80' }}>{n.status}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}