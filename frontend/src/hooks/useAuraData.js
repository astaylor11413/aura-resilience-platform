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
    const [greenVectorSlider, setGreenVectorSlider] = useState(() => getStored('greenVectorSlider', 1.0));
    const [is3DViewActive, setIs3DViewActive] = useState(() => getStored('is3DViewActive', false));
    const [isPredictiveMode, setIsPredictiveMode] = useState(() => getStored('isPredictiveMode', false));
    const [selectedParish, setSelectedParish] = useState(null);

    // Data Repositories
    const [gridAssets, setGridAssets] = useState([]);
    const [gridState, setGridState] = useState('NOMINAL');
    const [derOutput, setDerOutput] = useState(0.0);
    const [marineAnomalies, setMarineAnomalies] = useState([]);
    const [triageReport, setTriageReport] = useState(null);
    const [routingGeoJson, setRoutingGeoJson] = useState(INITIAL_GEOJSON);
    const [inundationGeoJson, setInundationGeoJson] = useState(INITIAL_GEOJSON);
    const [greenInfrastructureGeoJson, setGreenInfrastructureGeoJson] = useState(INITIAL_GEOJSON);
    const [parishGeoJson, setParishGeoJson] = useState(INITIAL_GEOJSON);
    const [roiMetrics, setRoiMetrics] = useState({
        green_infrastructure_capex_usd: 0,
        avoided_loss_usd: 0,
        net_economic_savings_usd: 0,
        roi_percentage: 0,
        attenuation_effectiveness_pct: 0
    });

    // Environment Base URL
    const API_BASE = import.meta.env.VITE_AURA_API_BASE_URL || 'https://aura-resilience-platform-prod.onrender.com/api/v1';

    // Helper to validate GeoJSON structural integrity
    const isValidGeoJSON = (data) => {
        return (
            data &&
            typeof data === 'object' &&
            data.type === 'FeatureCollection' &&
            Array.isArray(data.features)
        );
    };

    // Persistence Sync
    useEffect(() => {
        localStorage.setItem('aura_hurricaneIntensity', JSON.stringify(hurricaneIntensity));
        localStorage.setItem('aura_windSpeed', JSON.stringify(windSpeed));
        localStorage.setItem('aura_slrMeters', JSON.stringify(slrMeters));
        localStorage.setItem('aura_activeThreatIndex', JSON.stringify(activeThreatIndex));
        localStorage.setItem('aura_airGapped', JSON.stringify(airGapped));
        localStorage.setItem('aura_greenVectorSlider', JSON.stringify(greenVectorSlider));
        localStorage.setItem('aura_is3DViewActive', JSON.stringify(is3DViewActive));
        localStorage.setItem('aura_isPredictiveMode', JSON.stringify(isPredictiveMode));
    }, [hurricaneIntensity, windSpeed, slrMeters, activeThreatIndex, airGapped, greenVectorSlider, is3DViewActive, isPredictiveMode]);

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
// fetch parishes suppoort with fall back for failed endpoint case
useEffect(() => {
    if (airGapped) return;

    let isMounted = true;

    const fetchParishes = async () => {
        try {
            const response = await fetch(`${API_BASE}/spatial/parishes?wind=${windSpeed}&green=${greenVectorSlider}`);
            if (!response.ok) throw new Error(`API fetch failed: ${response.status}`);
            
            const data = await response.json();
            if (isMounted) setParishGeoJson(isValidGeoJSON(data) ? data : INITIAL_GEOJSON);
        } catch (error) {
            console.warn("Primary API failed, attempting fallback to local GeoJSON:", error);
            try {
                const fallbackResponse = await fetch('/data/jamaica_parishes.geojson');
                if (!fallbackResponse.ok) throw new Error(`Fallback status: ${fallbackResponse.status}`);
                
                const fallbackData = await fallbackResponse.json();
                if (isMounted && isValidGeoJSON(fallbackData)) {
                    // Normalize properties so PARISH and risk_level are guaranteed
                    const LOW_LYING_COASTAL_PARISHES = [
                        'Kingston', 
                        'Saint Andrew', 
                        'Saint Catherine', 
                        'Clarendon', 
                        'Manchester', 
                        'Saint Thomas'
                    ];
                    const normalizedFeatures = fallbackData.features.map(feature => {
                        const parishName = feature.properties.PARISH || feature.properties.shapeName || feature.properties.name || "Territory";
  const isCoastalLowland = LOW_LYING_COASTAL_PARISHES.some(p => 
    parishName.toLowerCase().includes(p.toLowerCase())
  );

  // Determine vulnerability factor: surge impact is 2.5x higher in coastal lowland zones
  const surgeImpact = isCoastalLowland ? (slrMeters * 2.5) : (slrMeters * 0.8);
  const compositeRiskScore = (windSpeed * 0.3) + (surgeImpact * 20);

  let calculatedRiskLevel = 'MODERATE';
  let dynamicFillColor = '#10b981'; // Green

  if (compositeRiskScore > 55 || (isCoastalLowland && slrMeters >= 1.5)) {
    calculatedRiskLevel = 'CRITICAL';
    dynamicFillColor = '#ef4444'; // Crimson Red for low-lying surge zones
  } else if (compositeRiskScore > 30 || surgeImpact > 1.0) {
    calculatedRiskLevel = 'ELEVATED';
    dynamicFillColor = '#f97316'; // Orange
  } else {
    calculatedRiskLevel = 'MODERATE';
    dynamicFillColor = '#38bdf8'; // Sky Blue / Green
  }

  return {
    ...feature,
    properties: {
      ...feature.properties,
      PARISH: parishName,
      risk_level: calculatedRiskLevel,
      fill_color: dynamicFillColor,
      is_coastal_lowland: isCoastalLowland
    }
  };
                    });

                    setParishGeoJson({
                        ...fallbackData,
                        features: normalizedFeatures
                    });
                }
            } catch (fallbackError) {
                console.error("Critical: Failed to load parish GeoJSON from API and local fallback.", fallbackError);
            }
        }
    };

    fetchParishes();

    return () => { isMounted = false; };
}, [windSpeed, slrMeters, greenVectorSlider, airGapped, API_BASE]);

// 2. fallback for ROI Analytics Sync in useAuraData.js
useEffect(() => {
    if (airGapped) return;

    fetch(`${API_BASE}/analytics/roi-calculator?slider_vector=${greenVectorSlider}&wind_speed_mph=${windSpeed}`)
        .then(res => {
            if (!res.ok) throw new Error("ROI endpoint offline");
            return res.json();
        })
        .then(data => setRoiMetrics(data))
        .catch(() => {
            // Local fallback calculation when backend returns 404
            const baseCapEx = 12500000;
            const capex = baseCapEx * greenVectorSlider;
            const avoidedLoss = capex * (1.8 + (windSpeed / 100));
            const attenuation = Math.min(85, 25 * greenVectorSlider);

            setRoiMetrics({
                green_infrastructure_capex_usd: capex,
                avoided_loss_usd: avoidedLoss,
                net_economic_savings_usd: avoidedLoss - capex,
                roi_percentage: ((avoidedLoss - capex) / capex) * 100,
                attenuation_effectiveness_pct: attenuation
            });
        });
}, [greenVectorSlider, windSpeed, airGapped, API_BASE]);

    // Debugging verification for Parish GeoJSON hydration
    useEffect(() => {
        if (parishGeoJson) {
            if (typeof parishGeoJson === 'string') {
                console.error('State Error: parishGeoJson hydrated as a string URL instead of a GeoJSON object!');
            } else if (parishGeoJson.type === 'FeatureCollection') {
                console.log('Success: parishGeoJson hydrated with', parishGeoJson.features.length, 'features.');
            }
        }
    }, [parishGeoJson]);

    //  Dynamic Green Infrastructure Vector GeoJSON Sync
    useEffect(() => {
        if (airGapped) return;

        fetch(`${API_BASE}/preventative/green-infrastructure?slider_vector=${greenVectorSlider}`)
            .then(res => res.json())
            .then(data => setGreenInfrastructureGeoJson(isValidGeoJSON(data) ? data : INITIAL_GEOJSON))
            .catch(() => setGreenInfrastructureGeoJson(INITIAL_GEOJSON));
    }, [greenVectorSlider, airGapped, API_BASE]);

    // 5. Dynamic ROI & Avoided Loss Analytics Sync
    useEffect(() => {
        if (airGapped) return;

        fetch(`${API_BASE}/analytics/roi-calculator?slider_vector=${greenVectorSlider}&wind_speed_mph=${windSpeed}`)
            .then(res => res.json())
            .then(data => setRoiMetrics(data))
            .catch(() => {});
    }, [greenVectorSlider, windSpeed, airGapped, API_BASE]);

    // 6. Static Oceanographic & Logistics Sync
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
        features: (marineAnomalies || []).map(feature => {
            const props = feature.properties || {};
            const existingImpact = props.economic_impact || {};

            return {
                ...feature,
                properties: {
                    ...props,
                    economic_impact: {
                        total_risk_exposure_usd: existingImpact.total_risk_exposure_usd ?? props.total_risk_exposure_usd ?? 1250000,
                        direct_economic_loss_usd: existingImpact.direct_economic_loss_usd ?? props.direct_economic_loss_usd ?? 850000,
                        blue_carbon_tons_lost: existingImpact.blue_carbon_tons_lost ?? props.blue_carbon_tons_lost ?? 4200,
                        carbon_liability_usd: existingImpact.carbon_liability_usd ?? props.carbon_liability_usd ?? 400000
                    }
                }
            };
        })
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
            hurricaneIntensity,
            greenVectorSlider,
            is3DViewActive,
            roiMetrics,
            isPredictiveMode,
            selectedParish
        },
        setters: {
            setWindSpeed,
            setSlrMeters,
            setActiveThreatIndex,
            setAirGapped,
            setTriageReport,
            setIsSimulating,
            setHurricaneIntensity,
            resetAuraState,
            setGreenVectorSlider,
            setIs3DViewActive,
            setRoiMetrics,
            setIsPredictiveMode,
            setSelectedParish
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
            inundationGeoJson,
            greenInfrastructureGeoJson,
            parishGeoJson
        }
    };
};