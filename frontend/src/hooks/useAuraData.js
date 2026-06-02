import { useState, useEffect } from 'react';

export const useAuraData = () => {
    // Local Storage
    const getStored = (key, fallback) => {
        try {
            const item = localStorage.getItem(`aura_${key}`);
            return item ? JSON.parse(item) : fallback;
        } catch { return fallback; }
    };
    // Core State
    const [isSimulating, setIsSimulating] = useState(false);
    const [hurricaneIntensity, setHurricaneIntensity] = useState(1);
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
        // Stability: Prevent network request if airGapped
        if (airGapped) return;

        const threatQuery = activeThreatIndex !== null ? `&threat_index=${activeThreatIndex}` : '';
        const controller = new AbortController();

        fetch(`https://aura-resilience-platform-qa.onrender.com/api/v1/resilience/simulate-grid?wind_speed_mph=${windSpeed}${threatQuery}`, { signal: controller.signal })
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
    }, [windSpeed, activeThreatIndex, airGapped]);

    // 2. Inundation Vector Sync
    useEffect(() => {
        // Stability: Prevent network request if airGapped
        if (airGapped) return;

        const controller = new AbortController();
        fetch(`https://aura-resilience-platform-qa.onrender.com/api/v1/hazard/inundation?slr_meters=${slrMeters}`, { signal: controller.signal })
            .then(res => res.json())
            .then(geoJson => {
                if (geoJson?.type === 'FeatureCollection') setInundationGeoJson(geoJson);
            })
            .catch(err => {
                if (err.name !== 'AbortError') console.error("Inundation fetch error:", err);
            });

        return () => controller.abort();
    }, [slrMeters, airGapped]);

    // 3. Static Oceanographic & Logistics Sync
    useEffect(() => {
        // Stability: Prevent network request if airGapped
        if (airGapped) return;

        fetch('https://aura-resilience-platform-qa.onrender.com/api/v1/marine/thermal-anomalies')
            .then(res => res.json())
            .then(data => { if (data?.features) setMarineAnomalies(data.features); })
            .catch(err => console.error("Marine fetch error:", err));

        fetch('https://aura-resilience-platform-qa.onrender.com/api/v1/spatial/mutual-aid-paths')
            .then(res => res.json())
            .then(geoJson => { if (geoJson?.features) setRoutingGeoJson(geoJson); })
            .catch(err => console.error("Routing fetch error:", err));
    }, [airGapped]);


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
        })).filter(f => f.geometry?.coordinates)
    };

    // Displayed Polygons for Marine Anomalies
    const compiledMarineGeoJson = {
        type: "FeatureCollection",
        features: marineAnomalies.map(anomaly => ({
            type: "Feature",
            geometry: anomaly.geometry,
            properties: { ...anomaly.properties, status: anomaly.properties?.ai_watchdog_status || 'NOMINAL' }
        }))
    };

    // Reset App Progress with Local Storage Clear
    const resetAuraState = () => {
        // Clear used keys 
        Object.keys(localStorage).forEach(key => {
            if (key.startsWith('aura_')) localStorage.removeItem(key);
        });

        // Reload the window to clear memory and re-initialize with defaults
        window.location.reload();
    };

    // Update the return object to include this in the setters
    return {
        // ... existing state/data/geoJson
        setters: {
            // ... existing setters
            resetAuraState
        }
    };

    return {
        state: {
            windSpeed, slrMeters, activeThreatIndex, airGapped, gridState, derOutput,
            isSimulating, hurricaneIntensity
        },
        setters: {
            setWindSpeed, setSlrMeters, setActiveThreatIndex, setAirGapped,
            setIsSimulating, setHurricaneIntensity
        },
        data: {
            gridAssets, marineAnomalies, triageReport, routingGeoJson, inundationGeoJson
        },
        geoJson: {
            compiledSubstationGeoJson, compiledMarineGeoJson
        }
    };
};