import { useState, useEffect } from 'react';

export const useAuraData = () => {
  // Core State
  const [windSpeed, setWindSpeed] = useState(25);
  const [slrMeters, setSlrMeters] = useState(0.0);
  const [activeThreatIndex, setActiveThreatIndex] = useState(null);
  const [airGapped, setAirGapped] = useState(false);
  
  // Data Repositories
  const [gridAssets, setGridAssets] = useState([]);
  const [gridState, setGridState] = useState('NOMINAL');
  const [derOutput, setDerOutput] = useState(0.0);
  const [marineAnomalies, setMarineAnomalies] = useState([]);
  const [triageReport, setTriageReport] = useState(null);
  const [routingGeoJson, setRoutingGeoJson] = useState({ type: 'FeatureCollection', features: [] });
  const [inundationGeoJson, setInundationGeoJson] = useState({ type: 'FeatureCollection', features: [] });

  // 1. Grid Simulation Sync
  useEffect(() => {
    const threatQuery = activeThreatIndex !== null ? `&threat_index=${activeThreatIndex}` : '';
    fetch(`https://aura-resilience-platform-qa.onrender.com/api/v1/resilience/simulate-grid?wind_speed_mph=${windSpeed}${threatQuery}`)
      .then(res => res.json())
      .then(data => {
        if (data && typeof data === 'object') {
          const assets = Array.isArray(data.assets) ? data.assets : (data.assets?.assets || []);
          setGridAssets(assets);
          setGridState(data.grid_state || 'NOMINAL');
          setDerOutput(data.calculated_der_output_kw || 0.0);
        }
      }).catch(() => setGridAssets([]));
  }, [windSpeed, activeThreatIndex]);

  // 2. Inundation Vector Sync
  useEffect(() => {
    fetch(`https://aura-resilience-platform-qa.onrender.com/api/v1/hazard/inundation?slr_meters=${slrMeters}`)
      .then(res => res.json())
      .then(geoJson => {
        if (geoJson?.type === 'FeatureCollection') setInundationGeoJson(geoJson);
      }).catch(err => console.error(err));
  }, [slrMeters]);

  // 3. Static Oceanographic & Logistics Sync
  useEffect(() => {
    fetch('https://aura-resilience-platform-qa.onrender.com/api/v1/marine/thermal-anomalies')
      .then(res => res.json())
      .then(data => { if (data?.features) setMarineAnomalies(data.features); });

    fetch('https://aura-resilience-platform-qa.onrender.com/api/v1/spatial/mutual-aid-paths')
      .then(res => res.json())
      .then(geoJson => { if (geoJson?.features) setRoutingGeoJson(geoJson); });
  }, []);

  // Derived GeoJSON Compilations
  const compiledSubstationGeoJson = {
    type: "FeatureCollection",
    features: gridAssets.map(asset => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: asset.coordinates },
      properties: { 
        id: asset.id, 
        name: asset.name, 
        status: asset.status?.toLowerCase().includes('critical') ? 'critical' : 'nominal' 
      }
    })).filter(f => f.geometry.coordinates)
  };

  const compiledMarineGeoJson = {
    type: "FeatureCollection",
    features: marineAnomalies.map(anomaly => ({
      type: "Feature",
      geometry: anomaly.geometry,
      properties: { ...anomaly.properties, status: anomaly.properties?.ai_watchdog_status || 'NOMINAL' }
    }))
  };

  return {
    state: { windSpeed, slrMeters, activeThreatIndex, airGapped, gridState, derOutput, manualReportText: '', isProcessingReport: false },
    setters: { setWindSpeed, setSlrMeters, setActiveThreatIndex, setAirGapped },
    data: { gridAssets, marineAnomalies, triageReport, routingGeoJson, inundationGeoJson },
    geoJson: { compiledSubstationGeoJson, compiledMarineGeoJson }
  };
};