import React, { useState, useRef, useEffect, useMemo } from 'react';
import Map, { Source, Layer, Marker } from 'react-map-gl';
import { Home, ShieldAlert, Box, DollarSign, TrendingUp } from 'lucide-react';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useAuraData } from './hooks/useAuraData';
import { HudPanel } from './components/HudPanel';
import { ImpactAnalysisPanel } from './components/ImpactAnalysisPanel';
import ThreeDSimulationPage from './ThreeDSimulationPage';
import { triggerDataDownload } from './utils/exportGeospatialData';
import {
  runLocalTriage,
  runLocalGridSimulation,
  runLocalInundation,
  runLocalMarineTelemetry,
  getModel
} from './utils/edgeEngine';


const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || '';
const HOME_COORDINATES = {
  longitude: -76.78,
  latitude: 17.95,
  zoom: 11
};
const HOME_3D_COORDINATES = {
  longitude: -76.78,
  latitude: 17.95,
  zoom: 15.5,
  pitch: 60,
  bearing: -17.6
};

// --- STATIC MAP STYLE LAYERS ---
export const substationLayer = {
  id: 'substation-layer',
  type: 'circle',
  paint: {
    'circle-radius': [
      'interpolate', ['linear'], ['zoom'],
      10, 5,
      15, 12
    ],
    'circle-color': [
      'interpolate',
      ['linear'],
      ['coalesce', ['get', 'threat_index'], 0], // Reads the live threat data, defaults to 0
      0, '#10b981',  // Stable / Safe (Emerald Green)
      4, '#f59e0b',  // Warning / Elevated (Amber)
      8, '#ef4444',  // Severe / Critical (Deep Red)
      11, '#b91c1c'  // Peak Catastrophe (Crimson)
    ],
    'circle-stroke-width': 2,
    'circle-stroke-color': '#ffffff',
    'circle-opacity': 0.9
  }
};

const marinePolygonLayer = {
  id: 'marine-anomaly-polygon-layer',
  type: 'fill',
  paint: {
    'fill-color': '#f59e0b',
    'fill-opacity': 0.15,
    'fill-outline-color': '#fbbf24'
  }
};

const marineGlowLayer = {
  id: 'marine-anomaly-glow-layer',
  type: 'circle',
  paint: {
    'circle-radius': [
      'interpolate', ['exponential', 2], ['zoom'],
      10, ['match', ['get', 'status'], 'CRITICAL_STORM_INCUBATION', 105, 60],
      13, ['match', ['get', 'status'], 'CRITICAL_STORM_INCUBATION', 210, 120],
      16, ['match', ['get', 'status'], 'CRITICAL_STORM_INCUBATION', 420, 240]
    ],
    'circle-color': '#f59e0b',
    'circle-opacity': 0.08,
    'circle-stroke-width': 1.5,
    'circle-stroke-color': '#fbbf24',
    'circle-stroke-opacity': 0.4
  }
};

const inundationLayer = {
  id: 'inundation-layer',
  type: 'fill',
  paint: {
    'fill-color': '#3b82f6',
    'fill-opacity': 0.4
  }
};

const fallbackEmptyGeoJSON = {
  type: 'FeatureCollection',
  features: []
};

// Parish Risk Highlighting Layer (Orange/Red Dynamic Render)
const parishRiskFillLayer = {
  id: 'parish-risk-fill',
  type: 'fill',
  paint: {
    'fill-color': [
      'coalesce',
      ['get', 'fill_color'],
      ['match', ['get', 'risk_level'],
        'CRITICAL', '#ef4444',
        'ELEVATED', '#f97316',
        'MODERATE', '#10b981',
        '#38bdf8' // Default fallback color if no property is matched
      ]
    ],
    'fill-opacity': 0.4
  }
};

const parishRiskLineLayer = {
  id: 'parish-risk-line',
  type: 'line',
  paint: {
    'line-color': '#0284c7',
    'line-width': 1.5
  }
};

// Preventative Green Infrastructure Vector Map Layers
const greenInfrastructureFillLayer = {
  id: 'green-infrastructure-fill',
  type: 'fill',
  paint: {
    'fill-color': '#10b981',
    'fill-opacity': 0.4
  }
};

const greenInfrastructureLineLayer = {
  id: 'green-infrastructure-line',
  type: 'line',
  paint: {
    'line-color': '#34d399',
    'line-width': 2,
    'line-dasharray': [2, 2]
  }
};

// 3D City View Building Extrusions
const building3DLayer = {
  id: '3d-buildings',
  source: 'composite',
  'source-layer': 'building',
  filter: ['==', 'extrude', 'true'],
  type: 'fill-extrusion',
  minzoom: 12,
  paint: {
    'fill-extrusion-color': '#334155',
    'fill-extrusion-height': ['get', 'height'],
    'fill-extrusion-base': ['get', 'min_height'],
    'fill-extrusion-opacity': 0.7
  }
};

const routingLayer = {
  id: 'routing-layer',
  type: 'line',
  layout: {
    'line-join': 'round',
    'line-cap': 'round'
  },
  paint: {
    'line-color': [
      'match',
      ['get', 'urgency'],
      'CRITICAL', '#ef4444',
      'HIGH', '#f97316',
      '#8b5cf6'
    ],
    'line-width': [
      'match',
      ['get', 'urgency'],
      'CRITICAL', 6,
      'HIGH', 4,
      2
    ],
    'line-dasharray': [2, 1.5],
  }
};

const getLogisticsBlurb = (facilityName, urgency) => {
  const name = String(facilityName || '').toLowerCase();
  const isKitchen = name.includes("kitchen");
  const isHub = name.includes("hub");

  if (urgency === 'CRITICAL') {
    if (isKitchen) return {
      text: "Supply chain bottleneck at food preparation site. Immediate risk of caloric deficit in shelter zones.",
      action: "DEPLOY: Mobile distribution fleet."
    };
    if (isHub) return {
      text: "Communication and coordination node compromised. Islanded communities are losing situational oversight.",
      action: "DEPLOY: Satellite comms relay unit."
    };
    return {
      text: "Medical/Supply relief station capacity reached. Critical backlog in emergency aid throughput.",
      action: "DEPLOY: Secondary triage field unit."
    };
  }
  return {
    text: "Operational status nominal. Maintaining flow of essential resources to designated zones.",
    action: "STATUS: Steady state operations."
  };
};

export default function App() {
  // Global context destructuring
  const { state: globalState, setters, data, geoJson } = useAuraData();

  // Local UI and telemetry states
  const [reportText, setReportText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [modelReady, setModelReady] = useState(false);
  const [showMarineLayer, setShowMarineLayer] = useState(false);
  const [showRoutingLayer, setShowRoutingLayer] = useState(false);
  const [showImpactAnalysis, setShowImpactAnalysis] = useState(false);
  const [currentTimeStep, setCurrentTimeStep] = useState(0);
  const [currentAlert, setCurrentAlert] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const [citizenReports, setCitizenReports] = useState([]);
  

  const mapRef = useRef(null);
  const tickerRef = useRef(null);

  const [viewState, setViewState] = useState({
    longitude: -76.78, latitude: 17.95, zoom: 11, pitch: 35
  });

  const toggle3DMode = () => {
    const next3DState = !globalState.is3DViewActive;
    setters.setIs3DViewActive(next3DState);
    const targetCoords = next3DState ? HOME_3D_COORDINATES : HOME_COORDINATES;
    
    setViewState(targetCoords);
    if (mapRef.current) {
      mapRef.current.flyTo({
        ...targetCoords,
        duration: 2000
      });
    }
  };

  // Clean up timers on component unmount
  useEffect(() => {
    return () => { if (tickerRef.current) clearInterval(tickerRef.current); };
  }, []);

  // Model Warm-up
  useEffect(() => {
    async function prepareEdge() {
      try {
        await getModel('triage');
        setModelReady(true);
      } catch (err) {
        console.error("Model failed to initialize:", err);
      }
    }
    prepareEdge();
  }, []);

  // Compute metrics: time vs structural footprints
  const structuralStats = useMemo(() => {
    const baseCurve = [0.08, 0.22, 0.41, 0.58, 0.72, 0.85, 0.93, 1.02, 1.08, 1.12, 1.15, 1.18];
    const multiplier = (globalState.windSpeed / 90) + (globalState.slrMeters * 0.2);
    const activeProfile = baseCurve.map(depth => depth * (multiplier > 0 ? multiplier : 1));
    const currentDepth = activeProfile[currentTimeStep];

    const criticalBreached = globalState.windSpeed > 75 ? 3 : globalState.windSpeed > 55 ? 1 : 0;
    const commercialBreached = globalState.windSpeed > 85 ? 6 : globalState.windSpeed > 60 ? 2 : 0;
    const highRiskPercent = Math.min(100, Math.round((globalState.windSpeed * 0.8) + (globalState.slrMeters * 5)));

    return {
      historicalDepthProfile: activeProfile,
      carsRisk: currentDepth > 0.3 ? Math.floor(14 * (currentTimeStep + 1) * 0.6) : 0,
      suvRisk: currentDepth > 0.6 ? Math.floor(8 * (currentTimeStep + 1) * 0.5) : 0,
      structuralFailure: currentDepth > 0.9 ? Math.floor(4 * (currentTimeStep - 4)) : 0,
      criticalTotal: 4,
      commercialTotal: 8,
      criticalBreached,
      commercialBreached,
      highRiskPercent
    };
  }, [currentTimeStep, globalState.windSpeed, globalState.slrMeters]);

  const jamaicaStructuresLayerConfig = useMemo(() => {
    const depthFactor = structuralStats.historicalDepthProfile[currentTimeStep];

    return {
    id: 'jamaica-structures-extruded-3d',
    type: 'fill-extrusion',
    source: 'composite',        // Mapbox Global Vector Tiles
    'source-layer': 'building', // Global 3D building layer
    minzoom: 12,                // Starts showing buildings as you zoom into Jamaica
    paint: {
      // Dynamic predictive color shift based on simulation step
      'fill-extrusion-color': depthFactor > 0.9
        ? '#f43f5e'
        : depthFactor > 0.6
          ? '#fb923c'
          : depthFactor > 0.3
            ? '#facc15'
            : '#38bdf8',

      // 'coalesce' tries 'height', then 'min_height' + 6, and defaults to 8 meters if missing
      'fill-extrusion-height': [
        'coalesce',
        ['get', 'height'],
        ['*', ['get', 'building:levels'], 3.5], // 3.5m per floor estimate
        8                                      // Fallback height (8m) so every Jamaican structure extrudes 3D
      ],
      'fill-extrusion-base': ['coalesce', ['get', 'min_height'], 0],
      'fill-extrusion-opacity': 0.85
    }
  };
}, [currentTimeStep, structuralStats]);

  const handlePanToTarget = (lng, lat) => {
    if (!lng || !lat) return;
    mapRef.current?.flyTo({
      center: [lng, lat],
      zoom: 12.5,
      essential: true,
      duration: 2000
    });
  };

  // LIVE INTERACTIVE TIMELINE ORCHESTRATOR (FIXED PANEL FOCUS & FLOODING MATCH)
  const triggerResilientOrchestrationStory = () => {
    if (tickerRef.current) clearInterval(tickerRef.current);

    // Coordinate through your context state modifiers
    setters.setIsSimulating(true);
    setters.setWindSpeed(88);
    setters.setSlrMeters(2.5);
    setters.setHurricaneIntensity(5);

    // Set local layout visibility configurations
    setShowImpactAnalysis(true);
    setShowRoutingLayer(false); // Hide mutual aid routes until alert is resolved
    setCurrentTimeStep(0);
    setCurrentAlert("Category 4 Hurricane Outer Bands reaching Jamaica. Commencing live operational monitoring.");

    const alertText = "Emergency operations engaged. Initializing interactive storm surge timeline tracking.";
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(alertText));

    const simulationTimeline = [
      { step: 1, alert: "Storm front tightening. Sea state telemetry indices elevating across the south shelf." },
      { step: 3, alert: "Storm surge rising to 1.5m. Palisadoes runway/airport link perimeters experiencing initial breach." },
      { step: 5, alert: "CRITICAL: Kingston Harbor waterfront layout reporting surge immersion. Localized power nodes offline." },
      { step: 7, alert: "AI Triage Engine: High risk of structural asset failure predicted across lower grid boundaries." },
      { step: 9, alert: "MAXIMUM BREACH: Surge peaking at 4.5m. Automating industrial utility isolation protocols." },
      { step: 11, alert: "Triage Complete. Crisis footprint successfully compiled. Triggering localized AI transcription." }
    ];

    tickerRef.current = setInterval(async () => {
      let currentStepValue;

      setCurrentTimeStep(prevStep => {
        const nextStep = prevStep + 1;
        currentStepValue = nextStep;

        const matchingMilestone = simulationTimeline.find(item => item.step === nextStep);
        if (matchingMilestone) {
          setCurrentAlert(matchingMilestone.alert);
        }

        if (nextStep >= 11) {
          clearInterval(tickerRef.current);
        }
        return nextStep;
      });

      // Trigger final phase when timeline reaches its peak
      if (currentStepValue >= 11) {
        clearInterval(tickerRef.current);

        // FIX: Case-insensitive search to reliably grab the element node
        const layoutPanels = Array.from(document.querySelectorAll('details'));
        const transcriberPanel = layoutPanels.find(el => {
          const headingText = el.querySelector('h2')?.textContent?.toLowerCase() || '';
          return headingText.includes('logistics transcriber');
        });

        if (transcriberPanel) {
          transcriberPanel.open = true;
          console.log("Aura Automation: Successfully forced Logistics Transcriber open attribute.");
        }

       // Step 2: Open up a typewriter effect inside the 600ms UI layout transition buffer
        setTimeout(() => {
          const incidentReport = "CRITICAL INUNDATION: Severe coastal flooding and flash surge overtopping the entire Palisadoes sector. Massive sea water drowning out lower surface zones.";
          
          let currentCharacterIndex = 0;
          setReportText(""); // Clear the text field to start typing clean
          setIsProcessing(true); // Turn on processing spinner styling early

          // Create a rapid internal character writer timer loop
          const typeWriterTimer = setInterval(async () => {
            setReportText(() => incidentReport.substring(0, currentCharacterIndex + 1));
            currentCharacterIndex++;

            // When the full message has finished typing out sequentially:
            if (currentCharacterIndex >= incidentReport.length) {
              clearInterval(typeWriterTimer);

              // Push the typed text block directly through your core triage engines
              try {
                let tacticalPlaybook = "";
                
                if (globalState.airGapped) {
                  const result = await runLocalTriage(incidentReport, globalState);
                  tacticalPlaybook = result.actionable_tactical_playbook;
                  if (result.matched_node_threat_index !== null) {
                    setters.setActiveThreatIndex(result.matched_node_threat_index);
                  }
                } else {
                  const formData = new FormData();
                  formData.append('text', incidentReport);
                  formData.append('air_gapped', 'false');
                  
                  const response = await fetch('https://aura-resilience-platform-qa.onrender.com/api/v1/voice/report', {
                    method: 'POST',
                    body: formData
                  });
                  const resData = await response.json();
                  tacticalPlaybook = resData.actionable_tactical_playbook;
                }

                // Voice distribution audio trigger chain
                const voiceBroadcastText = `Wah gwaan command center. Triage complete. ${tacticalPlaybook}`;
                
                try {
                  const audioResponse = await fetch('https://aura-resilience-platform-qa.onrender.com/api/v1/voice/broadcast', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text: voiceBroadcastText })
                  });

                  if (audioResponse.ok && audioResponse.headers.get('content-type')?.includes('audio/mpeg')) {
                    const audioBlob = await audioResponse.blob();
                    const audioUrl = URL.createObjectURL(audioBlob);
                    const audio = new Audio(audioUrl);
                    await audio.play();
                  } else {
                    window.speechSynthesis.speak(new SpeechSynthesisUtterance(voiceBroadcastText));
                  }
                } catch (audioErr) {
                  console.warn("Audio connection bypassed, dropping to local speech synthesis:", audioErr);
                  window.speechSynthesis.speak(new SpeechSynthesisUtterance(voiceBroadcastText));
                }

                // Display custom Alert popup overlay window to user
                alert(`[AURA EDGE PLAYBOOK] \n\n${tacticalPlaybook}`);
                
                // Cleanup and map activation layout states
                if (transcriberPanel) transcriberPanel.open = false;
                setShowImpactAnalysis(false); 
                setShowRoutingLayer(true);
                
              } catch (err) {
                console.error("Automated triage integration runner failure:", err);
              } finally {
                setIsProcessing(false);
              }
            }
          }, 35); // 35ms per character creates a fast, energetic human typing speed simulation
        }, 600);
      }
    }, 2000);
  };

  const handleProcessTransmission = async () => {
  if (!reportText.trim()) return;
  setIsProcessing(true);

  const rawText = reportText;
  const lowerText = rawText.toLowerCase();

  // --- 1. PARSE FLOOD / SURGE MENTION ---
  // Matches patterns like "2.5 meters", "2.5m", "3 meter"
  const slrMatch = lowerText.match(/(\d+(?:\.\d+)?)\s*(?:m|meters?|meter)/);
  if (slrMatch && slrMatch[1]) {
    const parsedSlr = parseFloat(slrMatch[1]);
    if (!isNaN(parsedSlr)) {
      setters.setSlrMeters(parsedSlr); // Updates Environmental Vectors slider & map overlay
    }
  }

  // --- 2. PARSE GRID / OUTAGE LOCATION ---
  let affectedNodeId = null;
  if (lowerText.includes('portmore')) {
    affectedNodeId = 1; // Maps to Portmore Substation ID
  } else if (lowerText.includes('kingston') || lowerText.includes('palisadoes')) {
    affectedNodeId = 0; // Maps to Kingston/Palisadoes Node ID
  }

  if (affectedNodeId !== null) {
    setters.setActiveThreatIndex(8); // Sets node threat index to Critical Red
  }

  // --- 3. DETERMINE MAP COORDINATES FOR CITIZEN PIN ---
  let reportCoords = [-76.78, 17.95]; // Default Kingston base [lng, lat]
  if (lowerText.includes('portmore')) {
    reportCoords = [-76.882, 17.955];
  } else if (lowerText.includes('palisadoes')) {
    reportCoords = [-76.753, 17.936];
  } else if (lowerText.includes('half way tree')) {
    reportCoords = [-76.798, 18.012];
  }

  // --- 4. CREATE NEW CITIZEN REPORT ENTRY ---
  const newReport = {
    id: `report-${Date.now()}`,
    text: rawText,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    coordinates: reportCoords,
    type: lowerText.includes('flood') || lowerText.includes('water') ? 'FLOOD' : 'GRID_OUTAGE',
    mediaUrl: null // Ready for file/photo uploads
  };

  setCitizenReports(prev => [newReport, ...prev]);

  // --- 5. RUN EXISTING AI TRIAGE / BACKEND PIPELINE ---
  try {
    if (globalState.airGapped) {
      const result = await runLocalTriage(rawText, globalState);
      alert(`[CITIZEN REPORT LOGGED]\n\nPlaybook: ${result.actionable_tactical_playbook}`);
    } else {
      const formData = new FormData();
      formData.append('text', rawText);
      formData.append('air_gapped', 'false');

      const response = await fetch('https://aura-resilience-platform-qa.onrender.com/api/v1/voice/report', {
        method: 'POST',
        body: formData
      });
      const resData = await response.json();
      alert(`[CITIZEN REPORT LOGGED]\n\nPlaybook: ${resData.actionable_tactical_playbook}`);
    }
  } catch (err) {
    console.error('Submission error:', err);
  } finally {
    setIsProcessing(false);
    setReportText(''); // Clear input after successful submit
  }
};

  // Resolve active telemetry datasets based on isolation mode
  const activeInundation = globalState.airGapped
    ? runLocalInundation(globalState.slrMeters)
    : (geoJson?.inundationGeoJson || { type: 'FeatureCollection', features: [] });

  let processedSubstationFeatures = [];
  let calculatedGridState = 'NOMINAL';

  if (globalState.airGapped) {
    const localGridResult = runLocalGridSimulation(globalState.windSpeed);
    calculatedGridState = localGridResult?.grid_state || 'NOMINAL';
    const localAssets = localGridResult?.assets || [];
    processedSubstationFeatures = localAssets.map(a => ({
      type: "Feature",
      properties: {
        id: a.id,
        name: a.name,
        rawStatus: a.status,
        status: a.status?.toLowerCase().includes('critical') ? 'critical' : 'nominal',
        power_routing: a.power_routing
      },
      geometry: { type: "Point", coordinates: a.coordinates }
    }));
  } else {
    calculatedGridState = globalState.gridState || 'NOMINAL';
    const cloudGeoJson = geoJson?.compiledSubstationGeoJson || { type: 'FeatureCollection', features: [] };
    const rawAssetsList = data?.gridAssets || [];

    processedSubstationFeatures = (cloudGeoJson.features || []).map(f => {
      const liveAssetMatch = rawAssetsList.find(a => a.id === f.properties?.id);
      return {
        ...f,
        properties: {
          ...f.properties,
          power_routing: liveAssetMatch ? liveAssetMatch.power_routing : 'MAIN_LINE_FEED'
        }
      };
    });
  }

  const activeMarineFeatures = globalState.airGapped
    ? runLocalMarineTelemetry()
    : (geoJson?.compiledMarineGeoJson?.features || []);

  const activeRoutingGeoJson = data?.routingGeoJson || { type: 'FeatureCollection', features: [] };

  // --- DATA SANITIZATION FILTERS ---
  const sanitizedSubstations = useMemo(() => {
    // Use processedSubstationFeatures as the source of truth
    const featuresToProcess = processedSubstationFeatures || [];

    if (featuresToProcess.length === 0) {
      return { type: "FeatureCollection", features: [] };
    }

    return {
      type: "FeatureCollection",
      features: featuresToProcess.map(node => {
        let liveThreat = 0;

        // 1. WIND SENSITIVITY
        if (globalState.windSpeed > 0) {
          liveThreat += Math.floor(globalState.windSpeed / 15);
        }

        // 2. WATER/FLOOD SENSITIVITY
        if (globalState.isSimulating && globalState.slrMeters > 0) {
          const isLowLying = node.properties?.elevation < 3 || node.properties?.sector === 'Palisadoes';
        
          if (isLowLying) {
            liveThreat += Math.floor(globalState.slrMeters * 2.5);
          } else {
            liveThreat += Math.floor(globalState.slrMeters * 1.2);
          }
        }

        // Cap threat index at 11
        const finalThreatIndex = Math.min(liveThreat, 11);

        // Verify coordinate order: Mapbox REQUIRES [longitude, latitude]
        const rawCoords = node.geometry?.coordinates || [0, 0];
        const validLngLat = rawCoords[0] > 0 && rawCoords[1] < 0 
          ? [rawCoords[1], rawCoords[0]] // Swaps [lat, lng] to [lng, lat] if positive lat comes first
          : rawCoords;

        return {
          ...node,
          geometry: {
            ...node.geometry,
            coordinates: validLngLat
          },
          properties: {
            ...node.properties,
            threat_index: finalThreatIndex // Feeds directly to substationLayer color interpolation
          }
        };
      })
    };
  }, [processedSubstationFeatures, globalState.windSpeed, globalState.slrMeters, globalState.isSimulating]);

  const sanitizedInundation = useMemo(() => {
    if (globalState.airGapped) return activeInundation;
    if (activeInundation?.features && activeInundation.features.length > 0) return activeInundation;

    return {
      type: "FeatureCollection",
      features: []
    };
  }, [globalState.airGapped, activeInundation]);

  return (
    <div className="relative w-screen min-h-screen md:h-screen md:overflow-hidden bg-slate-950 text-slate-100 font-sans">

      {/*REAL-TIME EMERGENCY SITUATION READOUT BANNER */}
      {globalState.isSimulating && currentAlert && (
        <div className="absolute top-20 left-1/2 transform -translate-x-1/2 z-[100] w-11/12 max-w-2xl bg-slate-950/95 border border-cyan-500/40 text-cyan-400 px-5 py-3.5 rounded-xl shadow-[0_0_30px_rgba(6,182,212,0.15)] backdrop-blur-md flex items-center gap-4 pointer-events-auto animate-pulse">
          <div className="h-2 w-2 rounded-full bg-cyan-400 animate-ping shrink-0" />
          <p className="text-xs font-mono tracking-wide leading-relaxed">{currentAlert}</p>
        </div>
      )}

      {/* MAP UNDERLAY */}
      <div className="absolute top-0 left-0 w-full h-[40vh] md:h-full z-0 pointer-events-auto">
        <Map
          {...viewState}
          ref={mapRef}
          onMove={evt => setViewState(evt.viewState)}
          mapboxAccessToken={MAPBOX_TOKEN}
          mapStyle="mapbox://styles/mapbox/dark-v11"
          interactiveLayerIds={globalState.isPredictiveMode ? ['parish-risk-fill'] : []}
          style={{ width: '100%', height: '100%' }}
        >
          {/* 1. Storm Surge Inundation Polygons */}
          <Source id="inundation-data" type="geojson" data={sanitizedInundation}>
            <Layer {...inundationLayer} />
          </Source>

          {/* 2. Mutual Aid Routes (Renders instantly post-alert) */}
          {showRoutingLayer && activeRoutingGeoJson.features?.length > 0 && (
            <Source id="routing-data" type="geojson" data={activeRoutingGeoJson}>
              <Layer {...routingLayer} />
              <Layer
                id="routing-labels"
                type="symbol"
                layout={{
                  'text-field': ['get', 'urgency'],
                  'text-size': 10,
                  'text-offset': [0, -1],
                  'text-anchor': 'bottom',
                  'symbol-placement': 'line'
                }}
                paint={{ 'text-color': '#ffffff' }}
              />
              <Layer
                id="routing-arrows"
                type="symbol"
                layout={{
                  'symbol-placement': 'line',
                  'symbol-spacing': 20,
                  'text-field': '▶',
                  'text-size': 40,
                  'text-keep-upright': true
                }}
                paint={{ 'text-color': '#ffffff' }}
              />
            </Source>            
          )}
          {/* DEMAND SHELTER DESTINATION PINS */}
          {showRoutingLayer && activeRoutingGeoJson.features.map((feature, idx) => {
            const coords = feature.geometry?.coordinates;
            if (!coords || coords.length === 0) return null;

            // Shelter coordinate is the destination (last point of the LineString path)
            const destinationCoord = coords[coords.length - 1];
            const [lng, lat] = destinationCoord;

            const shelterName = feature.properties?.destination_shelter || feature.properties?.shelter_name || 'Shelter Destination';
            const urgencyLevel = feature.properties?.urgency_level || 'HIGH';
            const isCritical = urgencyLevel === 'CRITICAL';

            return (
              <Marker
                key={feature.properties?.id || `shelter-marker-${idx}`}
                longitude={lng}
                latitude={lat}
                anchor="bottom"
              >
                <div className="flex flex-col items-center group pointer-events-auto cursor-pointer">
                  {/* Hover Tooltip */}
                  <div className="hidden group-hover:flex flex-col bg-slate-950/95 border border-purple-500/40 text-slate-100 font-mono text-[10px] px-2.5 py-1.5 rounded-lg shadow-xl whitespace-nowrap mb-1">
                    <span className="font-bold text-purple-300">🏠 {shelterName}</span>
                    <span className={`text-[8px] font-semibold ${isCritical ? 'text-rose-400' : 'text-amber-400'}`}>
                      URGENCY: {urgencyLevel}
                    </span>
                  </div>

                  {/* Pulse Beacon Pin */}
                  <div className="relative flex items-center justify-center">
                    <span className={`absolute h-6 w-6 rounded-full animate-ping ${isCritical ? 'bg-rose-500/40' : 'bg-purple-500/40'}`} />
                    <div className="h-7 w-7 rounded-full bg-slate-950 border-2 border-purple-400 flex items-center justify-center text-purple-300 shadow-[0_0_12px_rgba(168,85,247,0.6)]">
                      <Home size={13} />
                    </div>
                  </div>
                </div>
              </Marker>
            );
          })}
          {/* 3. Oceanographic anomalies */}
          {showMarineLayer && activeMarineFeatures.length > 0 && (
  <>
    <Source id="marine-data" type="geojson" data={{ type: "FeatureCollection", features: activeMarineFeatures }}>
      <Layer {...marinePolygonLayer} />
      <Layer {...marineGlowLayer} />
    </Source>

    {activeMarineFeatures.map((feature, idx) => {
      const coords = feature.geometry?.coordinates;
      if (!coords || coords.length === 0) return null;

      // Handle both Point [lng, lat] and Polygon/MultiPolygon coordinate structures safely
      const lng = typeof coords[0] === 'number' ? coords[0] : coords[0]?.[0]?.[0];
      const lat = typeof coords[1] === 'number' ? coords[1] : coords[0]?.[0]?.[1];

      if (!lng || !lat) return null;

      const props = feature.properties || {};
      const impact = props.economic_impact || {};
      const locName = props.location_name || '';

      // Check if feature is "Caribbean Coral Bleaching Cluster A" or display metrics for all active watchdogs
      const directEcon = (impact.direct_economic_loss_usd ?? props.direct_economic_loss_usd ?? 850000).toLocaleString();
      const blueCarbon = impact.blue_carbon_tons_lost ?? props.blue_carbon_tons_lost ?? 4200;
      const carbonLiability = (impact.carbon_liability_usd ?? props.carbon_liability_usd ?? 400000).toLocaleString();
      const microplastic = props.microplastic_density_ppm ?? 450.2;

      return (
        <Marker
          key={props.id || `marine-marker-${idx}`}
          longitude={lng}
          latitude={lat}
          anchor="center"
        >
          <div className="bg-slate-950/90 backdrop-blur-md border border-amber-500/50 p-2 rounded-lg shadow-[0_0_15px_rgba(245,158,11,0.25)] font-mono text-[9px] pointer-events-auto cursor-pointer hover:scale-105 transition-transform">
            <div className="text-[10px] font-bold text-amber-400 border-b border-white/10 pb-1 mb-1 flex items-center justify-between gap-2">
              <span>{locName || 'Marine Anomaly'}</span>
              <span className="text-[8px] bg-amber-500/20 text-amber-300 px-1 rounded">
                +{props.surface_temp_anomaly_celsius || 0}°C
              </span>
            </div>

            <div className="space-y-0.5 text-slate-300">
              <div className="flex justify-between gap-3">
                <span className="text-slate-400">Direct Econ Loss:</span>
                <span className="text-amber-300 font-bold">${directEcon}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-slate-400">Blue Carbon Loss:</span>
                <span className="text-cyan-300 font-bold">{blueCarbon} tCO₂e</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-slate-400">Carbon Liability:</span>
                <span className="text-rose-400 font-bold">${carbonLiability}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-slate-400">Microplastics:</span>
                <span className="text-emerald-400 font-bold">{microplastic} ppm</span>
              </div>
            </div>
          </div>
        </Marker>
      );
    })}
  </>
)}

         
        {/* 3D City View Building Extrusions */}
        {globalState.is3DViewActive && <Layer {...building3DLayer} />}

        {/* Parish Risk Vector Highlighting (Orange/Red Dynamic Render) */}
      {globalState.isPredictiveMode && (
  <Source id="parish-risk-data" type="geojson" data={
          geoJson?.parishGeoJson && geoJson.parishGeoJson.features?.length 
          ? geoJson.parishGeoJson 
            : fallbackEmptyGeoJSON
  }>
    <Layer 
      {...parishRiskFillLayer} 
      onMouseEnter={() => {
        if (mapRef.current) mapRef.current.getCanvas().style.cursor = 'pointer';
      }}
      onMouseLeave={() => {
        if (mapRef.current) mapRef.current.getCanvas().style.cursor = '';
      }}
      onClick={(e) => {
        if (e.features && e.features.length > 0) {
          const clickedFeature = e.features[0];
          const parishName = clickedFeature.properties?.PARISH || clickedFeature.properties?.name || "Territory";
          
          // Set active parish in global state
          setters.setSelectedParish(parishName);

          // Extract center/first coordinate safely
          const geom = clickedFeature.geometry;
          let centerLngLat = [-76.792, 17.971]; // Fallback (Kingston)

          if (geom.type === 'Polygon') {
            centerLngLat = geom.coordinates[0][0];
          } else if (geom.type === 'MultiPolygon') {
            centerLngLat = geom.coordinates[0][0][0];
          }

          // Fly map camera to the target parish and tilt into 3D perspective
          mapRef.current?.flyTo({
            center: centerLngLat,
            zoom: 15.5,
            pitch: 60,
            bearing: -17.6,
            duration: 2000
          });

          // Activate 3D extrusion view
          setters.setIs3DViewActive(true);
        }
      }}
    />
    <Layer {...parishRiskLineLayer} />
  </Source>
)}

        {/* Dynamic Preventative Green Infrastructure Vector Render */}
        {geoJson.greenInfrastructureGeoJson && (
          <Source id="green-infrastructure-data" type="geojson" data={geoJson.greenInfrastructureGeoJson}>
            <Layer {...greenInfrastructureFillLayer} />
            <Layer {...greenInfrastructureLineLayer} />
          </Source>
        )}
          {/* 4. GNN SUBSTATION NODES - RENDERED DIRECTLY TO DARK MAP BASE */}
          <Source id="substation-data" type="geojson" data={sanitizedSubstations}>
            <Layer {...substationLayer} />
          </Source>

          {/* 5. 3D STRUCTURAL EXTRUSIONS LAYER - RUNS DURING SIMULATION TIMELINE */}
          {showImpactAnalysis && (
              <Layer {...jamaicaStructuresLayerConfig} />
          )}

          {/* 6. CITIZEN INCIDENT MARKERS (CITIZENS-STYLE) */}
{citizenReports.map((report) => (
  <Marker
    key={report.id}
    longitude={report.coordinates[0]}
    latitude={report.coordinates[1]}
    anchor="center"
  >
    <div className="relative flex items-center justify-center group pointer-events-auto cursor-pointer">
      {/* Outer Pulse Ring */}
      <span className={`absolute h-6 w-6 rounded-full animate-ping ${
        report.type === 'FLOOD' ? 'bg-cyan-500/50' : 'bg-rose-500/50'
      }`} />
      
      {/* Center Dot */}
      <div className={`h-4 w-4 rounded-full border-2 border-white shadow-lg flex items-center justify-center text-[8px] font-bold ${
        report.type === 'FLOOD' ? 'bg-cyan-500 text-slate-950' : 'bg-rose-600 text-white'
      }`}>
        !
      </div>

      {/* Hover / Click Popup Card */}
      <div className="hidden group-hover:flex flex-col absolute bottom-6 left-1/2 -translate-x-1/2 w-56 bg-slate-950/95 border border-cyan-500/40 p-2.5 rounded-xl shadow-2xl backdrop-blur-md z-50 text-[10px] font-mono">
        <div className="flex justify-between items-center border-b border-white/10 pb-1 mb-1">
          <span className="font-bold text-cyan-400 uppercase tracking-wider">
            {report.type === 'FLOOD' ? '🌊 Flood Incident' : '⚡ Grid Outage'}
          </span>
          <span className="text-slate-500 text-[8px]">{report.timestamp}</span>
        </div>
        <p className="text-slate-200 text-[9px] leading-relaxed mb-1 font-sans">{report.text}</p>
        <span className="text-[8px] text-emerald-400 font-mono">STATUS: VERIFIED GROUND-TRUTH</span>
      </div>
    </div>
  </Marker>
))}
        </Map>

        {/* 3D overlay blending for atmospheric/particle filters */}
        {globalState.isSimulating && typeof ThreeDSimulationPage === 'function' && (
          <div className="absolute inset-0 z-10 pointer-events-none mix-blend-screen opacity-40">
             <ThreeDSimulationPage 
               currentTimeStep={currentTimeStep}
               geoData={geoJson?.structuresGeoJson}
               simulationArgs={{
                 slrMeters: globalState.slrMeters,
                 windSpeed: globalState.windSpeed,
                 threatIndex: globalState.activeThreatIndex
               }}
             />
          </div>
        )}
      </div>

      {/* FOREGROUND HUD LAYOUT */}
      <div className="relative md:absolute inset-0 z-30 pt-[42vh] md:pt-0 p-4 md:p-6 pointer-events-none grid grid-cols-1 md:grid-cols-12 md:grid-rows-[auto_1fr_auto] h-full gap-4">

        {/* HEADER BAR */}
        <header className="col-span-1 md:col-span-12 h-14 bg-slate-900/80 backdrop-blur-md border border-white/5 rounded-xl flex items-center justify-between px-6 pointer-events-auto order-first md:order-none">
          <div className="flex items-center gap-3">
            <div className={`h-3 w-3 rounded-full ${calculatedGridState === 'NOMINAL' ? 'bg-emerald-500' : 'bg-rose-500'} animate-pulse`} />
            <h1 className="text-sm font-bold tracking-widest text-white uppercase">AURA Command Center</h1>
          </div>
          <div className="flex items-center gap-6 font-mono text-xs text-slate-400">
            <div className="relative inline-block text-left">
              <button
                onClick={() => setIsOpen(!isOpen)}
                className="bg-white/5 hover:bg-white/10 text-[10px] text-slate-300 px-3 py-1.5 rounded border border-white/10 transition-colors flex items-center gap-1.5"
              >
                <span>EXPORT GIS DATA</span>
                <span className="text-[8px] text-slate-400">▼</span>
              </button>

              {isOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-slate-900 border border-slate-700 rounded shadow-xl z-50">
                  <div className="py-1">
                    <button
                      onClick={() => {
                        triggerDataDownload(activeMarineFeatures, 'aura_marine_telemetry', 'geojson');
                        setIsOpen(false);
                      }}
                      className="w-full text-left px-4 py-2 text-xs text-slate-300 hover:bg-slate-800 hover:text-emerald-400 font-mono transition-colors"
                    >
                      GeoJSON Feature Collection
                      <span className="block text-[10px] text-slate-500 font-sans">For QGIS, ArcGIS, Mapbox</span>
                    </button>

                    <button
                      onClick={() => {
                        triggerDataDownload(activeMarineFeatures, 'aura_stac_catalog', 'stac');
                        setIsOpen(false);
                      }}
                      className="w-full text-left px-4 py-2 text-xs text-slate-300 hover:bg-slate-800 hover:text-emerald-400 font-mono border-t border-slate-800 transition-colors"
                    >
                      STAC 1.0.0 Metadata Catalog
                      <span className="block text-[10px] text-slate-500 font-sans">SpatioTemporal Asset Catalog</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
            <div className="h-4 w-[1px] bg-slate-700" />
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={!!globalState.airGapped}
                onChange={(e) => setters.setAirGapped(e.target.checked)}
                className="rounded bg-slate-950 border-white/10 text-purple-600 focus:ring-0 w-3 h-3"
              />
              <span>Air Gapped Mode</span>
            </label>
            <div className="h-4 w-[1px] bg-slate-700" />

            {/* New Predictive Planning Mode Checkbox */}
            <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-mono text-emerald-400 font-semibold hover:text-emerald-300">
              <input
                type="checkbox"
                checked={globalState.isPredictiveMode}
                onChange={e => setters.setIsPredictiveMode(e.target.checked)}
                className="rounded border-slate-600 bg-slate-800 text-emerald-500 focus:ring-0 focus:ring-offset-0 accent-emerald-500 cursor-pointer"
              />
              <span>Predictive Planning Mode</span>
            </label>
          </div>
        </header>
        
        {/* Dynamic HUD Panel Render via Ternary Condition */}
        {globalState.isPredictiveMode ? (
        
        /* ================= PREDICTIVE PLANNING HUD OVERLAYS ================= */
        <>
          {/* Left Panel: Green Infrastructure Slider & Controls */}
          <div className="col-span-1 md:col-span-3 flex flex-col gap-4 pointer-events-auto overflow-y-auto">
        <HudPanel title="Aura Infrastructure Vector HUD">
          <div className="flex flex-col gap-3 text-xs text-white font-mono">
            
            {/* Preventative Green Vector Slider Controller */}
            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-emerald-400 font-bold">
                <span>Green Infrastructure Vector:</span>
                <span>{globalState.greenVectorSlider.toFixed(1)}x</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="3.0"
                step="0.1"
                value={globalState.greenVectorSlider}
                onChange={e => setters.setGreenVectorSlider(parseFloat(e.target.value))}
                className="w-full accent-emerald-500 cursor-pointer pointer-events-auto"
              />
            </div>

            {/* Hurricane Telemetry Control */}
            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-amber-400">
                <span>Storm Telemetry Wind Speed:</span>
                <span>{globalState.windSpeed} MPH</span>
              </div>
              <input
                type="range"
                min="20"
                max="120"
                step="5"
                value={globalState.windSpeed}
                onChange={e => setters.setWindSpeed(parseInt(e.target.value))}
                className="w-full accent-amber-500 cursor-pointer pointer-events-auto"
              />
            </div>

            <div className="flex gap-2 pt-2 border-t border-white/10 pointer-events-auto">
              <button
                onClick={toggle3DMode}
                className={`flex-1 py-1.5 rounded border flex items-center justify-center gap-1.5 text-[11px] font-semibold transition-colors ${
                  globalState.is3DViewActive 
                    ? 'bg-cyan-600 border-cyan-400 text-white' 
                    : 'bg-slate-800 border-slate-600 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <Box size={14} /> {globalState.is3DViewActive ? 'Exit 3D City' : '3D City View'}
              </button>
            </div>
          </div>
        </HudPanel>
      </div>

      {/* CENTER VISUAL ACCOMMODATION COUPLER */}
      <div className="hidden md:block md:col-span-6" />

          {/* Right Panel: Dynamic ROI & Avoided-Loss Calculation Engine */}
          <div className="col-span-1 md:col-span-3 flex flex-col gap-4 pointer-events-auto overflow-y-auto">
        <HudPanel title={globalState.selectedParish ? `ROI Engine — ${globalState.selectedParish}` : "Select a Parish to Simulate"}>
  {globalState.selectedParish ? (
    <div className="flex flex-col gap-2.5 text-xs text-white font-mono">
      <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
        <span className="text-slate-400">Target Community:</span>
        <span className="font-bold text-emerald-400">{globalState.selectedParish}</span>
      </div>

      <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
        <span className="text-slate-400">Infrastructure CapEx:</span>
        <span className="font-bold text-slate-200">
          ${((globalState.roiMetrics.green_infrastructure_capex_usd * globalState.greenVectorSlider) / 1000000).toFixed(2)}M
        </span>
      </div>

      <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
        <span className="text-slate-400">Avoided Loss:</span>
        <span className="font-bold text-emerald-400">
          ${((globalState.roiMetrics.avoided_loss_usd * globalState.greenVectorSlider) / 1000000).toFixed(2)}M
        </span>
      </div>

      <div className="bg-slate-900/80 p-2 rounded border border-emerald-500/20 text-[10px] text-emerald-300">
        Wave Attenuation: <span className="font-bold">{(globalState.roiMetrics.attenuation_effectiveness_pct * globalState.greenVectorSlider).toFixed(1)}%</span>
      </div>
    </div>
  ) : (
    <div className="text-xs text-slate-400 italic py-4 text-center">
      Click on a territory boundary on the map to focus 3D simulation and calculate Green Infrastructure ROI.
    </div>
  )}
</HudPanel>
      </div>
        </>

      ) : (

        /* ================= STANDARD OPERATIONAL HUD OVERLAYS ================= */
        <>
          {/*Default HUD Panels */}
        {/* LEFT CONTROL COLUMN */}
        <div className="col-span-1 md:col-span-3 flex flex-col gap-4 pointer-events-auto overflow-y-auto">
          <div>
            <button
              onClick={triggerResilientOrchestrationStory}
              className="w-full bg-rose-600 hover:bg-rose-500 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors mb-2"
            >
              <ShieldAlert size={18} /> {globalState.isSimulating ? "Simulation Active..." : "Simulate Hurricane Impact"}
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => { if (tickerRef.current) clearInterval(tickerRef.current); setCurrentAlert(null); if (window.confirm("Purge local session data?")) setters.resetAuraState(); }} className="bg-rose-900/30 hover:bg-rose-900/60 text-rose-500 text-[10px] px-3 py-1.5 rounded border border-rose-900/50">
                System Reset
              </button>
              <button onClick={() => { if (tickerRef.current) clearInterval(tickerRef.current); setCurrentAlert(null); if (globalState.isSimulating) setters.setIsSimulating(false); mapRef.current?.flyTo({ center: [HOME_COORDINATES.longitude, HOME_COORDINATES.latitude], zoom: HOME_COORDINATES.zoom, essential: true, duration: 1500 }); }} className="bg-white/5 hover:bg-white/10 text-[10px] text-slate-300 px-3 py-1.5 rounded border border-white/10">
                Reset Map View
              </button>
            </div>
          </div>
          {/* Dynamic Switch Panel Layout */}
          {!showImpactAnalysis ? (
            <>
              <HudPanel title="Storm Tracker">
                <div className="text-[10px] text-slate-300 space-y-2">
                  <p>No storm activity at this time.</p>            
                </div>
              </HudPanel>
            </>
          ) : (
            <>
            <ImpactAnalysisPanel
              currentTimeStep={currentTimeStep}
              onTimeStepChange={(newStep) => {
                // If user touches slider manually, kill autopilot loop to prevent overriding them
                if (tickerRef.current) clearInterval(tickerRef.current);
                setCurrentTimeStep(newStep);
              }}
              structuralStats={structuralStats}
              onClose={() => {
                if (tickerRef.current) clearInterval(tickerRef.current);
                setCurrentAlert(null);
                setShowImpactAnalysis(false);
                setters.setIsSimulating(false);
              }}
            />
            </>
          )}
          <HudPanel title="Logistics & Mutual Aid" onToggle={setShowRoutingLayer}>
            <div className="max-h-56 overflow-y-auto pr-2 space-y-2">
                {(activeRoutingGeoJson.features || []).map((route, i) => {
                  const originKitchen = route.properties?.origin_kitchen || 'Unknown Kitchen';
                  const destShelter = route.properties?.destination_shelter || 'Unknown Shelter';
                  const urgency = route.properties?.urgency || 'LOW';
                  const blurb = getLogisticsBlurb(originKitchen, urgency);
                  return (
                    <div key={i} className="bg-slate-900/50 p-3 rounded border border-white/10 text-[10px] font-mono">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-emerald-400 font-bold">{originKitchen}</span>
                        <span className="text-slate-500">to</span>
                        <span className="text-purple-400 font-bold">{destShelter}</span>
                      </div>
                      <p className="text-slate-300 leading-tight mb-2 italic">"{blurb.text}"</p>
                      <div className="bg-slate-950 p-1.5 rounded border border-purple-500/30 text-purple-300 font-bold uppercase tracking-wider text-[9px]">
                        {blurb.action}
                      </div>
                    </div>
                  );
                })}
              </div>
            </HudPanel>
        </div>
        

        {/* CENTER VISUAL ACCOMMODATION COUPLER */}
        <div className="hidden md:block md:col-span-6" />

        {/* RIGHT INTERACTIVE COLUMN */}
        <div className="col-span-1 md:col-span-3 flex flex-col gap-4 pointer-events-auto overflow-y-auto">
          <HudPanel title="JPS Grid Status">
            <div className="max-h-48 overflow-y-auto pr-2 space-y-2">
              {processedSubstationFeatures.map(feat => {
                const props = feat.properties || {};
                const coords = feat.geometry?.coordinates;
                return (
                  <details
                    key={props.id}
                    className="bg-slate-900/50 p-2 rounded border border-white/5 cursor-pointer group"
                    onToggle={(e) => {
                      if (e.currentTarget.open && coords) {
                        handlePanToTarget(coords[0], coords[1]);
                      }
                    }}
                  >
                    <summary className="text-[11px] font-mono text-emerald-400 list-none flex justify-between items-center select-none">
                      <span>{props.name}</span>
                      <span className="text-slate-500 group-open:rotate-180 transition-transform text-[9px]">▼</span>
                    </summary>
                    <div className="text-[10px] text-slate-400 mt-2 border-t border-white/5 pt-2 font-mono space-y-1">
                      <div>Status: <span className={props.status?.toUpperCase().includes('CRITICAL') ? 'text-rose-400' : 'text-emerald-300'}>{props.status}</span></div>
                      <div className="text-slate-500 text-[9px]">Routing: {props.power_routing}</div>
                    </div>
                  </details>
                );
              })}
            </div>
          </HudPanel>
          <HudPanel title="Environmental Vectors">
            <div className="space-y-1">
              <div className="flex justify-between text-[10px] text-slate-400 font-mono"><span>Wind Field</span><span className="text-emerald-400">{globalState.windSpeed} MPH</span></div>
              <input type="range" min="10" max="100" value={globalState.windSpeed} onChange={(e) => setters.setWindSpeed(Number(e.target.value))} className="w-full accent-emerald-400 cursor-pointer" />
            </div>
            <div className="space-y-1 pt-2">
              <div className="flex justify-between text-[10px] text-slate-400 font-mono"><span>Sea Level Surge</span><span className="text-emerald-400">+{globalState.slrMeters}m</span></div>
              <input type="range" min="0" max="3" step="0.5" value={globalState.slrMeters} onChange={(e) => setters.setSlrMeters(Number(e.target.value))} className="w-full accent-emerald-400 cursor-pointer" />
            </div>            
            </div>
            {globalState.activeThreatIndex !== null && (
              <button
                onClick={() => setters.setActiveThreatIndex(null)}
                className="mt-2 text-[9px] font-mono text-rose-400 hover:underline block text-left"
              >
                Clear Override Threat Node (Index: {globalState.activeThreatIndex})
              </button>
            )}
          </HudPanel>

          <HudPanel title="Oceanographic Watchdog" onToggle={setShowMarineLayer}>
            <div className="max-h-56 overflow-y-auto pr-2 space-y-2">
              {activeMarineFeatures.map((m, i) => {
                const locName = m.properties?.location_name || 'Anomalous Region';
                const tempAnomaly = m.properties?.surface_temp_anomaly_celsius || 0;
                const microplasticPpm = m.properties?.microplastic_density_ppm || 0;
                const impact = m.properties?.economic_impact || {};
                const geomCoords = m.geometry?.coordinates;
                let localImpactBlurb = "Monitoring regional baseline indices. Elevated surface metrics signal early risks.";

                if (locName.includes("Coral Bleaching Cluster A")) {
                  localImpactBlurb = `A +${tempAnomaly}°C spike here accelerates severe coral bleaching across nearshore reefs. For locals, this threatens critical artisanal fishing grounds and degrades the natural storm barriers shielding the Kingston shoreline.`;
                } else if (locName.includes("Pedro Bank")) {
                  localImpactBlurb = `This massive +${tempAnomaly}°C anomaly in the pelagic gyre traps heavy sargassum biomass. Drifting fields choke down south-coast harbors, drop marine oxygen values, and disrupt active commercial fishing links.`;
                } else if (locName.includes("Algal Stress Hotspot")) {
                  localImpactBlurb = `Sustained temperatures +${tempAnomaly}°C above historical norms trigger rapid toxic microalgae spikes on the shallow shelf. This risks bioaccumulation issues in shellfish maps and harms beach infrastructure groups.`;
                }

                return (
                  <details
                    key={i}
                    className="bg-slate-900/50 p-2 rounded border border-white/5 cursor-pointer group"
                    onToggle={(e) => {
                      if (e.currentTarget.open && geomCoords && !globalState.isSimulating) {
                        handlePanToTarget(geomCoords[0], geomCoords[1]);
                      }
                    }}
                  >
                    <summary className="text-[10px] font-mono list-none flex justify-between items-center select-none">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-bold text-slate-200 group-hover:text-teal-400 transition-colors">{locName}</span>
                        <span className="text-[9px] text-slate-500 font-sans">Watchdog: {m.properties?.ai_watchdog_status || 'MONITOR'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-teal-400 font-bold">+{tempAnomaly}°C</span>
                        <span className="text-slate-500 group-open:rotate-180 transition-transform text-[8px]">▼</span>
                      </div>
                    </summary>
                    <div className="text-[10px] text-slate-400 mt-2 border-t border-white/5 pt-2 font-sans leading-relaxed space-y-1.5">
                      <div className="text-[9px] font-mono uppercase tracking-wider text-teal-500 font-bold">Community & Ecosystem Impact:</div>
                      <p className="text-slate-300">{localImpactBlurb}</p>
                    </div>
                    {/* FINANCIAL & BLUE CARBON VALUATION DISPLAY */}
                    <div className="bg-slate-950/60 p-2 rounded border border-teal-500/20 font-mono space-y-1">
                      <div className="text-[9px] uppercase text-teal-400 font-bold tracking-wider flex justify-between">
                        <span>Est. Risk Exposure:</span>
                        <span className="text-emerald-400">${(impact.total_risk_exposure_usd || 0).toLocaleString()} USD</span>
                      </div>                      
                    </div>
                  </details>
                );
              })}
            </div>
          </HudPanel>          
        </div>

        {/* VOICE TRANSCRIPTION TRANSCRIBER PANEL */}
        <div className="col-span-1 md:col-span-12 z-[60] pointer-events-auto mt-auto">
          <HudPanel title="Logistics Transcriber">
            <div className="flex gap-2 items-center">
  <label className="cursor-pointer bg-slate-900 hover:bg-slate-800 border border-white/10 p-2.5 rounded-lg text-slate-400 hover:text-white transition-colors" title="Attach Proof Photo/Video">
    <input type="file" accept="image/*,video/*" className="hidden" onChange={(e) => {
      if (e.target.files?.[0]) {
        alert(`Attachment staged: ${e.target.files[0].name}`);
      }
    }} />
    📷
  </label>
  <textarea
    value={reportText}
    onChange={(e) => setReportText(e.target.value)}
    placeholder="Report an issue (e.g. 'Water flooding at 2.5 meters in Kingston' or 'Grid down in Portmore')..."
    className="flex-grow h-14 bg-slate-950/50 border border-white/10 rounded p-2 text-xs text-slate-200 resize-none focus:border-purple-500 outline-none font-sans"
  />
  <button
    type="button"
    onClick={handleProcessTransmission}
    disabled={isProcessing}
    className="bg-purple-600 hover:bg-purple-500 disabled:bg-purple-800 text-[10px] px-4 py-2 rounded font-bold uppercase transition-colors text-white whitespace-nowrap"
  >
    {isProcessing ? 'Processing...' : 'Submit Report'}
  </button>
</div>
          </HudPanel>
        </div>
        </>

      )}
      </div>
    </div>
  );
}