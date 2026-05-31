import React, { useState, useEffect } from 'react';
import Map, { Source, Layer, Marker } from 'react-map-gl';
import { Wind, Activity, Volume2, Users, HardHat, Waves, ShieldAlert } from 'lucide-react';
import 'mapbox-gl/dist/mapbox-gl.css';

const MAPBOX_TOKEN = 'YOUR_MAPBOX_ACCESS_TOKEN';

export default function App() {
  const [viewState, setViewState] = useState({ latitude: 17.96, longitude: -76.79, zoom: 9 });
  const [isMutualAidMode, setIsMutualAidMode] = useState(false);
  const [windSpeed, setWindSpeed] = useState(25);
  const [slrMeters, setSlrMeters] = useState(0.0);
  const [gridData, setGridData] = useState(null);
  const [oceanData, setOceanData] = useState(null);
  const [floodGeoJson, setFloodGeoJson] = useState(null);
  const [routingGeoJson, setRoutingGeoJson] = useState(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  useEffect(() => {
    fetch('http://127.0.0.1:8000/api/v1/ocean/telemetry')
      .then(res => res.json()).then(data => setOceanData(data));
  }, []);

  useEffect(() => {
    fetch(`http://127.0.0.1:8000/api/v1/resilience/simulate-grid?wind_speed_mph=${windSpeed}`)
      .then(res => res.json()).then(data => setGridData(data));
  }, [windSpeed]);

  useEffect(() => {
    fetch(`http://127.0.0.1:8000/api/v1/hazard/inundation?slr_meters=${slrMeters}`)
      .then(res => res.json()).then(data => setFloodGeoJson(data));
  }, [slrMeters]);

  useEffect(() => {
    fetch('http://127.0.0.1:8000/api/v1/mutual-aid/routes')
      .then(res => res.json()).then(data => setRoutingGeoJson(data));
  }, [isMutualAidMode]);

  // High-Impact Single-Tap Story Mode Selector
  const triggerStormImpactStoryMode = () => {
    setWindSpeed(85);
    setSlrMeters(2.0);
    triggerTTSAlert("WARNING. Category 4 storm conditions simulated. Extreme inundation threshold met. Grids adjusting.");
  };

  const handleModeSwitch = () => {
    if (!isMutualAidMode) {
      setViewState({ latitude: 40.73, longitude: -73.93, zoom: 10 }); // Re-centers onto NYC
    } else {
      setViewState({ latitude: 17.96, longitude: -76.79, zoom: 9 });  // Re-centers onto Caribbean
    }
    setIsMutualAidMode(!isMutualAidMode);
  };

  const floodLayerStyle = {
    id: 'flood-zones', type: 'fill',
    paint: { 'fill-color': '#ef4444', 'fill-opacity': 0.4 }
  };

  const routeLineStyle = {
    id: 'route-lines', type: 'line',
    paint: { 'line-color': '#38bdf8', 'line-width': 4, 'line-dasharray': [2, 2] }
  };

  const triggerTTSAlert = (customMsg) => {
    setIsPlayingAudio(true);
    const msg = customMsg || (isMutualAidMode 
      ? "Mutual aid pathways functional. Resolving critical community supply pipelines."
      : "Analyzing NASA satellite streams. AI Watchdog scanning for rapid storm incubation signatures.");
    const utterance = new SpeechSynthesisUtterance(msg);
    utterance.onend = () => setIsPlayingAudio(false);
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div style={{ fontFamily: 'sans-serif', backgroundColor: '#0f172a', color: '#fff', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{ padding: '14px 20px', borderBottom: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#0f172a' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Activity color={isMutualAidMode ? "#38bdf8" : "#00ffcc"} />
          <h1 style={{ fontSize: '15px', margin: 0, fontWeight: 800 }}>AURA // MULTI-HAZARD RESILIENCE ECOSYSTEM</h1>
        </div>
        <button onClick={handleModeSwitch} style={{ backgroundColor: isMutualAidMode ? '#38bdf8' : '#1e293b', color: isMutualAidMode ? '#0f172a' : '#fff', border: '1px solid #38bdf8', padding: '6px 14px', borderRadius: '20px', fontWeight: 'bold', cursor: 'pointer' }}>
          {isMutualAidMode ? "Ecosystem Tracker" : "Activate Mutual Aid Mode"}
        </button>
      </header>

      <div style={{ flex: 1, display: 'flex', flexDirection: window.innerWidth < 768 ? 'column' : 'row' }}>
        {/* Core Map */}
        <div style={{ flex: 1, position: 'relative', minHeight: '400px' }}>
          <Map {...viewState} onMove={evt => setViewState(evt.viewState)} mapStyle="mapbox://styles/mapbox/dark-v11" mapboxAccessToken={MAPBOX_TOKEN}>
            {isMutualAidMode && routingGeoJson && (
              <Source id="mutual-aid-routes" type="geojson" data={routingGeoJson}><Layer {...routeLineStyle} /></Source>
            )}
            {!isMutualAidMode && floodGeoJson && (
              <Source id="coastal-flooding" type="geojson" data={floodGeoJson}><Layer {...floodLayerStyle} /></Source>
            )}
            {!isMutualAidMode && oceanData?.features?.map((feat, i) => (
              <Marker key={i} latitude={feat.geometry.coordinates[1]} longitude={feat.geometry.coordinates[0]}>
                <div style={{ width: '16px', height: '16px', background: 'rgba(239, 68, 68, 0.3)', borderRadius: '50%', border: '2px solid #ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title={feat.properties.location_name}>
                  <Waves size={10} color="#ef4444" />
                </div>
              </Marker>
            ))}
            {gridData?.nodes?.map(node => (
              <Marker key={node.id} latitude={node.lat} longitude={node.lng}>
                <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: node.status.includes('COLLAPSED') ? '#ef4444' : isMutualAidMode ? '#38bdf8' : '#22c55e', border: '1px solid #fff' }} />
              </Marker>
            ))}
          </Map>
        </div>

        {/* Action Panel Sidebar */}
        <div style={{ width: window.innerWidth < 768 ? '100%' : '360px', padding: '20px', backgroundColor: '#0f172a', borderLeft: '1px solid #334155', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '15px' }}>
          
          {!isMutualAidMode ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button onClick={triggerStormImpactStoryMode} style={{ width: '100%', backgroundColor: '#ef4444', border: 'none', padding: '12px', borderRadius: '6px', color: '#fff', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <ShieldAlert size={16} /> Simulate Category 4 Storm
              </button>

              <div style={{ backgroundColor: '#0b2545', padding: '12px', borderRadius: '8px', border: '1px solid #134074' }}>
                <h3 style={{ margin: '0 0 6px 0', fontSize: '12px', color: '#64dfdf' }}><Waves size={14} /> NOAA INUNDATION ENGINE</h3>
                <label style={{ fontSize: '11px' }}>Sea Level Rise: <strong>{slrMeters} Meters</strong></label>
                <input type="range" min="0.0" max="3.0" step="0.5" value={slrMeters} onChange={(e) => setSlrMeters(parseFloat(e.target.value))} style={{ width: '100%', margin: '6px 0' }} />
              </div>

              <div style={{ backgroundColor: '#1e293b', padding: '12px', borderRadius: '8px', border: '1px solid #334155' }}>
                <h3 style={{ margin: '0 0 6px 0', fontSize: '12px', color: '#00ffcc' }}><Wind size={14} /> NASA WIND PROFILE</h3>
                <label style={{ fontSize: '11px' }}>Velocity Threshold: <strong>{windSpeed} MPH</strong></label>
                <input type="range" min="15" max="100" value={windSpeed} onChange={(e) => setWindSpeed(Number(e.target.value))} style={{ width: '100%', margin: '6px 0' }} />
              </div>
            </div>
          ) : (
            <div style={{ backgroundColor: '#0f2d2b', padding: '16px', borderRadius: '8px', border: '1px solid #114b43' }}>
              <h3 style={{ margin: '0 0 4px 0', fontSize: '13px', color: '#4ade80' }}><Users size={16} /> CIVIC DISPATCH</h3>
              <p style={{ fontSize: '12px', color: '#cbd5e1', margin: 0 }}>Routing verified municipal surpluses directly to high-priority disaster shelters.</p>
            </div>
          )}

          <button onClick={() => triggerTTSAlert()} style={{ width: '100%', backgroundColor: '#0284c7', border: 'none', padding: '12px', borderRadius: '6px', color: '#fff', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <Volume2 size={16} /> {isPlayingAudio ? "Streaming Stream..." : "Synthesize System Audio"}
          </button>

          <div style={{ background: '#111827', padding: '14px', borderRadius: '8px', border: '1px solid #1e293b', flex: 1 }}>
            <h4 style={{ margin: '0 0 8px 0', fontSize: '11px', color: '#64748b', letterSpacing: '0.5px' }}><HardHat size={12} /> ECOSYSTEM LOG ANALYSIS</h4>
            <div style={{ fontSize: '11px', lineHeight: '1.5', color: '#e2e8f0' }}>
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