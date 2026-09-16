
export const runCascadeSimulation = ({ windSpeed, slrMeters, marineAnomalies, gridAssets, routingGeoJson }) => {
  // 1. Calculate Marine Valuation Matrix
  const marineImpact = marineAnomalies.map(anomaly => {
    const temp = anomaly.properties?.surface_temp_anomaly_celsius || 0;
    return {
      id: anomaly.properties?.location_name,
      carbonLoss: temp * 15.2,
      riskLevel: temp > 2.5 ? 'CRITICAL' : 'MODERATE'
    };
  });

  // 2. Compute Inundation & Road Closures
  const floodRiskMultiplier = slrMeters * 1.4;
  const updatedRoutes = {
    ...routingGeoJson,
    features: (routingGeoJson.features || []).map(route => ({
      ...route,
      properties: {
        ...route.properties,
        status: (slrMeters > 1.5 && route.properties?.low_elevation) ? 'BLOCKED' : 'CLEAR'
      }
    }))
  };

  // 3. Compute Cascading Substation Failures
  const updatedGrid = gridAssets.map(asset => {
    const isWindRisk = windSpeed > asset.wind_threshold_mph;
    const isFloodRisk = floodRiskMultiplier > asset.elevation_meters;
    
    let status = 'NOMINAL';
    if (isWindRisk && isFloodRisk) status = 'CRITICAL_COMPOUND';
    else if (isWindRisk || isFloodRisk) status = 'WARNING';

    return { ...asset, status };
  });

  return {
    marineImpact,
    updatedGrid,
    updatedRoutes,
    cascadeSeverityScore: (windSpeed * 0.4) + (slrMeters * 20)
  };
};