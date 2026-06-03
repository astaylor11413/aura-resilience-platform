import { useState, useEffect } from 'react';

// Rigid fallback structure to prevent Mapbox layout compilation errors
const INITIAL_GEOJSON = {
    type: 'FeatureCollection',
    features: []
};

export const useAuraData = () => {
    // Local Storage Hydration
    const getStored = (key, fallback) => {
        try {
            const item = localStorage.getItem(`aura_${key}`);
            return item ? JSON.parse(item) : fallback;
        } catch { return fallback; }
    };

    // Core Control State
    const [isSimulating, setIsSimulating] = useState(false);
    const [hurricaneIntensity, setHurricaneIntensity] = useState(() => getStored('hurricaneIntensity', 1));
    const [windSpeed, setWindSpeed] = useState(() => getStored('windSpeed', 25));
    const [slrMeters, setSlrMeters] = useState(() => getStored('slrMeters', 0.0));
    const [activeThreatIndex, setActiveThreatIndex] = useState(() => getStored('activeThreatIndex', null));
    const [airGapped, setAirGapped] = useState(() => getStored('airGapped', false));

    // Data Repositories
    const [gridAssets, setGridAssets] = useState([]);
    const [gridState, setGridState] = useState('NOMINAL');
    const [derOutput, setDerOutput] = useState(0.0);
    const [marineAnomalies, setMarineAnomalies] = useState([]);
    const [triageReport, setTriageReport] = useState(null);
    const [routingGeoJson, setRoutingGeoJson] = useState(INITIAL_GEOJSON);
    const [inundationGeoJson, setInundationGeoJson] = useState(INITIAL_GEOJSON);

    // Environment Base URL
    const API_BASE = import.meta.env.VITE_AURA_API_BASE_URL || 'https://aura-resilience-platform-prod.onrender.com/api/v1';

    // Persistence Sync
    useEffect(() => {
        localStorage.setItem('aura_hurricaneIntensity', JSON.stringify(hurricaneIntensity));
        localStorage.setItem('aura_windSpeed', JSON.stringify(windSpeed));
        localStorage.setItem('aura_slrMeters', JSON.stringify(slrMeters));
        localStorage.setItem('aura_activeThreatIndex', JSON.stringify(activeThreatIndex));
        localStorage.setItem('aura_airGapped', JSON.stringify(airGapped));
    }, [hurricaneIntensity, windSpeed, slrMeters, activeThreatIndex, airGapped]);

    // 1. Grid Simulation Sync
    useEffect(() => {
        if (airGapped) return;

        const threatQuery = activeThreatIndex !== null ? `&threat_index=${activeThreatIndex}` : '';
        const controller = new AbortController();

        fetch(`${API_BASE}/resilience/simulate-grid?wind_speed_mph=${windSpeed}${threatQuery}`, { signal: controller.signal })
            .then(res => res.json())
            .then(data => {
                if (data && typeof data === 'object') {
                    const assets = Array.isArray(data.assets) ? data.assets : (data.assets?.assets || []);
                    setGridAssets(assets);
                    setGridState(data.grid_state || 'NOMINAL');
                    setDerOutput(data.calculated_der_output_kw || 0.0);
                }
            })
            .catch(err => {
                if (err.name !== 'AbortError') setGridAssets([]);
            });

        return () => controller.abort();
    }, [windSpeed, activeThreatIndex, airGapped, API_BASE]);

    // 2. Inundation Vector Sync
    useEffect(() => {
        if (airGapped) return;

        const controller = new AbortController();
        fetch(`${API_BASE}/hazard/inundation?slr_meters=${slrMeters}`, { signal: controller.signal })
            .then(res => res.json())
            .then(geoJson => {
                if (geoJson?.type === 'FeatureCollection') {
                    setInundationGeoJson(geoJson);
                } else {
                    setInundationGeoJson(INITIAL_GEOJSON);
                }
            })
            .catch(err => {
                if (err.name !== 'AbortError') {
                    console.error("Inundation fetch error:", err);
                    setInundationGeoJson(INITIAL_GEOJSON);
                }
            });

        return () => controller.abort();
    }, [slrMeters, airGapped, API_BASE]);

    // 3. Static Oceanographic & Logistics Sync
    useEffect(() => {
        if (airGapped) return;

        fetch(`${API_BASE}/marine/thermal-anomalies`)
            .then(res => res.json())
            .then(data => { 
                if (data?.features) setMarineAnomalies(data.features); 
            })
            .catch(err => console.error("Marine fetch error:", err));

        fetch(`${API_BASE}/spatial/mutual-aid-paths`)
            .then(res => res.json())
            .then(geoJson => { 
                if (geoJson?.type === 'FeatureCollection') {
                    setRoutingGeoJson(geoJson);
                } else if (geoJson?.features) {
                    setRoutingGeoJson({ type: 'FeatureCollection', features: geoJson.features });
                } else {
                    setRoutingGeoJson(INITIAL_GEOJSON);
                }
            })
            .catch(err => {
                console.error("Routing fetch error:", err);
                setRoutingGeoJson(INITIAL_GEOJSON);
            });
    }, [airGapped, API_BASE]);

    // Derived GeoJSON Compilations
    const compiledSubstationGeoJson = {
        type: "FeatureCollection",
        features: (gridAssets || []).map(asset => ({
            type: "Feature",
            geometry: { type: "Point", coordinates: asset.coordinates },
            properties: {
                id: asset.id,
                name: asset.name,
                status: asset.status?.toLowerCase().includes('critical') ? 'critical' : 'nominal'
            }
        })).filter(f => f.geometry?.coordinates)
    };

    const compiledMarineGeoJson = {
        type: "FeatureCollection",
        features: (marineAnomalies || []).map(anomaly => ({
            type: "Feature",
            geometry: anomaly.geometry,
            properties: { ...(anomaly.properties || {}), status: anomaly.properties?.ai_watchdog_status || 'NOMINAL' }
        }))
    };

    // System Wiping Utility
    const resetAuraState = () => {
        Object.keys(localStorage).forEach(key => {
            if (key.startsWith('aura_')) localStorage.removeItem(key);
        });
        window.location.reload();
    };

    return {
        state: {
            windSpeed,
            slrMeters,
            activeThreatIndex,
            airGapped,
            gridState,
            derOutput,
            isSimulating,
            hurricaneIntensity
        },
        setters: {
            setWindSpeed,
            setSlrMeters,
            setActiveThreatIndex,
            setAirGapped,
            setIsSimulating,
            setHurricaneIntensity,
            resetAuraState
        },
        data: {
            gridAssets,
            marineAnomalies,
            triageReport,
            routingGeoJson
        },
        geoJson: {
            compiledSubstationGeoJson,
            compiledMarineGeoJson,
            inundationGeoJson
        }
    };
};