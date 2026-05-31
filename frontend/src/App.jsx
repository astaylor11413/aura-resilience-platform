import React, { useState, useEffect } from 'react';
import Map, { Source, Layer, Marker } from 'react-map-gl';
import { Wind, Activity, Volume2, Users, HardHat, Waves, ShieldAlert, Radio } from 'lucide-react';
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
  const [liveTranscription, setLiveTranscription] = useState("");
  const [isProcessingAudio, setIsProcessingAudio] = useState(false);

  useEffect(() => {
    fetch('http://127.0.0.1:8000/api/v1/ocean/telemetry').then(res => res.json()).then(data => setOceanData(data));
  }, []);

  useEffect(() => {
    fetch(`http://127.0.0.1:8000/api/v1/resilience/simulate-grid?wind_speed_mph=${windSpeed}`).then(res => res.json()).then(data => setGridData(data));
  }, [windSpeed]);

  useEffect(() => {
    fetch(`http://127.0.0.1:8000/api/v1/hazard/inundation?slr_meters=${slrMeters}`).then(res => res.json()).then(data => setFloodGeoJson(data));
  }, [slrMeters]);

  // High-Impact Single-Tap Story Mode Selector
  const triggerStormImpactStoryMode = () => {
    setWindSpeed(85);
    setSlrMeters(2.5);
    triggerOutboundBroadcast("Attention all citizens: Extreme coastal surge expected. Move inland immediately. Localized shelters are open.");
  };

  // Mock Field Audio Post Request to verify Whisper Endpoint Pipeline
  const sendMockFieldVoiceReport = () => {
    setIsProcessingAudio(true);
    setLiveTranscription("Connecting field link stream...");
    
    const formData = new FormData();
    // Simulate empty blob to cleanly trigger backend transcription loop placeholder
    formData.append("audio", new Blob(), "field_report.wav");

    fetch('http://127.0.0.1:8000/api/v1/voice/report', { method: 'POST', body: formData })
      .then(res => res.json())
      .then(data => {
        setLiveTranscription(data.transcription);
        setIsProcessingAudio(false);
      });
  };

  // Fires Outbound ElevenLabs Stream or WebSpeech API Fallback smoothly
  const triggerOutboundBroadcast = (textString) => {
    const textToDeliver = textString || "Warning: Environmental conditions deteriorating.";
    
    fetch('http://127.0.0.1:8000/api/v1/voice/broadcast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: textToDeliver })
    })
    .then(res => {
      if (res.headers.get("content-type") === "audio/mpeg") {
        return res.blob().then(blob => {
          const audioUrl = URL.createObjectURL(blob);
          new Audio(audioUrl).play();
        });
      } else {
        // Native WebSpeech Client fallback if server keys are unassigned during testing
        const utterance = new SpeechSynthesisUtterance(textToDeliver);
        window.speechSynthesis.speak(utterance);
      }
    });
  };

  return (
    <div style={{ fontFamily: 'sans-serif', backgroundColor: '#0f172a', color: '#fff', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{ padding: '14px 20px', borderBottom: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#0f172a' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Activity color="#00ffcc" />
          <h1 style={{ fontSize: '14px', margin: 0, fontWeight: 800 }}>AURA // ECOSYSTEM BROADCAST HUB</h1>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => setIsMutualAidMode(!isMutualAidMode)} style={{ backgroundColor: '#1e293b', border: '1px solid #334155', color: '#fff', padding: '6px 12px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}>
            Toggle Sub-Layers
          </button>
        </div>
      </header>

      <div style={{ flex: 1, display: 'flex', flexDirection: window.innerWidth < 768 ? 'column' : 'row' }}>
        {/* Map View */}
        <div style={{ flex: 1, position: 'relative', minHeight: '400px' }}>
          <Map {...viewState} onMove={evt => setViewState(evt.viewState)} mapStyle="mapbox://styles/mapbox/dark-v11" mapboxAccessToken={MAPBOX_TOKEN}>
            {floodGeoJson && <Source id="flood-shapes" type="geojson" data={floodGeoJson}><Layer type="fill" paint={{ 'fill-color': '#ef4444', 'fill-opacity': 0.35 }} /></Source>}
            {oceanData?.features?.map((feat, i) => (
              <Marker key={i} latitude={feat.geometry.coordinates[1]} longitude={feat.geometry.coordinates[0]}>
                <div style={{ width: '14px', height: '14px', background: 'rgba(239, 68, 68, 0.4)', borderRadius: '50%', border: '2px solid #ef4444' }} />
              </Marker>
            ))}
          </Map>
        </div>

        {/* Master Audio System Side 控制面板 */}
        <div style={{ width: window.innerWidth < 768 ? '100%' : '360px', padding: '20px', backgroundColor: '#0f172a', borderLeft: '1px solid #334155', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '15px' }}>
          
          <button onClick={triggerStormImpactStoryMode} style={{ width: '100%', backgroundColor: '#ef4444', border: 'none', padding: '12px', borderRadius: '6px', color: '#fff', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <ShieldAlert size={16} /> Run Automated Disaster Protocol
          </button>

          {/* AI SPEECH INTERFACE SECTION */}
          <div style={{ backgroundColor: '#0b2545', padding: '14px', borderRadius: '8px', border: '1px solid #134074' }}>
            <h3 style={{ margin: '0 0 6px 0', fontSize: '12px', color: '#64dfdf', display: 'flex', alignItems: 'center', gap: '6px' }}><Radio size={14} /> LINGUISTIC CRISIS RESPONSE</h3>
            <span style={{ fontSize: '11px', color: '#cbd5e1' }}>Direct dialect translation module bypasses language obstacles using OpenAI Whisper & ElevenLabs Voice accents.</span>
            
            <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button onClick={() => triggerOutboundBroadcast(null)} style={{ width: '100%', backgroundColor: '#1e3a8a', border: '1px solid #3b82f6', color: '#fff', padding: '8px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}>
                Test Outbound Dialect Alert (TTS)
              </button>
              <button onClick={sendMockFieldVoiceReport} style={{ width: '100%', backgroundColor: '#111827', border: '1px solid #374151', color: '#a7f3d0', padding: '8px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}>
                {isProcessingAudio ? "Transcribing with Whisper..." : "Ingest Local Audio Report (STT)"}
              </button>
            </div>
          </div>

          {/* Live Translation Monitor Window */}
          {liveTranscription && (
            <div style={{ background: '#1e1b4b', padding: '12px', borderRadius: '6px', border: '1px solid #4338ca' }}>
              <h4 style={{ margin: '0 0 4px 0', fontSize: '10px', color: '#818cf8', letterSpacing: '0.5px' }}>LIVE TRANSLATED STREAM CONSOLE</h4>
              <p style={{ fontSize: '12px', margin: 0, fontStyle: 'italic', color: '#e0e7ff' }}>{liveTranscription}</p>
            </div>
          )}

          {/* Environmental Multi-Sliders */}
          <div style={{ backgroundColor: '#1e293b', padding: '12px', borderRadius: '8px', border: '1px solid #334155' }}>
            <label style={{ fontSize: '11px', color: '#94a3b8' }}>Manual Sea Level Rise: <strong>{slrMeters}m</strong></label>
            <input type="range" min="0.0" max="3.0" step="0.5" value={slrMeters} onChange={(e) => setSlrMeters(parseFloat(e.target.value))} style={{ width: '100%', marginBottom: '10px' }} />
            
            <label style={{ fontSize: '11px', color: '#94a3b8' }}>Manual Wind Conditions: <strong>{windSpeed} MPH</strong></label>
            <input type="range" min="15" max="100" value={windSpeed} onChange={(e) => setWindSpeed(Number(e.target.value))} style={{ width: '100%' }} />
          </div>

          <div style={{ background: '#111827', padding: '14px', borderRadius: '8px', border: '1px solid #1e293b', flex: 1 }}>
            <h4 style={{ margin: '0 0 6px 0', fontSize: '11px', color: '#64748b' }}><HardHat size={12} /> UTILITY INFRASTRUCTURE STATE</h4>
            <div style={{ fontSize: '11px', color: '#cbd5e1' }}>
              {gridData?.nodes?.map(n => (
                <div key={n.id} style={{ marginBottom: '4px' }}>
                  <span style={{ color: '#94a3b8' }}>{n.name}:</span> <strong style={{ color: n.status === "COLLAPSED" ? "#f87171" : "#4ade80" }}>{n.status}</strong>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}