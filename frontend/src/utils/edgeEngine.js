import { pipeline } from '@xenova/transformers';
import survivalData from '../../public/data/state.json'; // Ensure your DB is exported here

// Singleton pipeline cache
let pipelines = {};

export async function getModel(type) {
  if (pipelines[type]) return pipelines[type];
  if (type === 'triage') {
    pipelines.triage = await pipeline('zero-shot-classification', 'Xenova/distilbert-base-uncased-mnli');
  }
  return pipelines[type];
}

export const runLocalTriage = async (text) => {
  const classifier = await getModel('triage');
  const labels = ["Severe Flooding", "Power Grid Failure", "Structural Damage"];
  const res = await classifier(text, labels);

  const primaryThreat = res.labels[0]; // "Severe Flooding", etc.
  const threatIndex = text.toLowerCase().includes('palisadoes') ? 1 : 0;

  // Localized dialect playbook dictionary mapping matching your app.py layout
  const localPlaybooks = {
    "Severe Flooding": "Hear dis now, attention across the coastline. Big storm surge a come and the water dem heavy down south. Close the sea-wall gates immediately! Every emergency vehicle, clear off the low roads right now and take the high-elevation transit lanes. Move fast!",
    "Power Grid Failure": "Red alert, the main transmission lines dem drop and the power grid mash up completely. We a cut off the main feed now and locking into local microgrid power. Repair crews, pack up your gear and dispatch straight to the isolated sectors down the line.",
    "Structural Damage": "Listen up, the substation structures dem compromise and the boundary breach severe. Engineering field units, look sharp and move out now. Secure the whole perimeter and hold up the energy framework before the next line drop."
  };

  // Fallback string if classification drops into an unexpected variant
  const fallbackPlaybook = `[EDGE_MODE] Triage Complete: ${primaryThreat}. Look sharp and execute local safety protocols immediately.`;

  return {
    triage_incident_profile: primaryThreat,
    matched_node_threat_index: threatIndex,
    // Safely look up the dialect string or hit the fallback template
    actionable_tactical_playbook: localPlaybooks[primaryThreat] || fallbackPlaybook
  };
};

export const runLocalGridSimulation = (windSpeed, threatIndex) => {
  const { mock_grid_substations } = survivalData;
  const available_wattage = windSpeed >= 12 && windSpeed <= 90 ? Math.round(0.12 * Math.pow(windSpeed, 1.8) * 100) / 100 : 0.0;

  const assets = mock_grid_substations.map(asset => {
    // Determine structural vulnerability based on positioning and asset types
    let vuln = (windSpeed > 70 && asset.type === "Main-Transmission") ? 1.25 : 0.2;
    if (asset.graph_index === threatIndex) vuln += 0.4; // Target index override from voice triage

    let stability = 1.0 - (0.004 * windSpeed) - (0.12 * vuln);
    stability = Math.max(0.0, Math.min(1.0, stability));

    let status;

    // the main transmission lines, the asset is down, regardless of its type.
    if (stability < 0.50 || (windSpeed >= 75 && asset.type === "Main-Transmission")) {
      status = "CRITICAL // SEVERED // DOWN";
    }
    else if (windSpeed >= 55.0 && (asset.type === "Critical-Hospital-Node" || asset.type === "Microgrid-Hub")) {
      status = "ISLANDED // ACTIVE // AUTONOMOUS";
    }
    // Otherwise, the grid asset operates normally on mainline power feeds.
    else {
      status = "ONLINE // CENTRALIZED";
    }

    return {
      ...asset,
      status: `${status} (${(stability * 100).toFixed(2)}% Stability)`,
      power_routing: status.includes("ISLANDED") ? "LOCAL_BATTERY_ARRAY" : "MAIN_LINE_FEED"
    };
  });

  // Dynamically update overall system status based on cumulative component state failures
  const structuralCollapseCount = assets.filter(a => a.status.includes("CRITICAL")).length;
  let grid_state = "NOMINAL";

  if (structuralCollapseCount === assets.length) {
    grid_state = "SYSTEM_BLACKOUT";
  } else if (structuralCollapseCount > 0 || windSpeed >= 55.0) {
    grid_state = "DEGRADED_ISLAND_MODE";
  }

  return { grid_state, assets };
};

export const runLocalInundation = (slr) => {
  return {
    type: "FeatureCollection",
    features: survivalData.mock_coastal_dem
      .filter(z => slr >= z.elevation_m)
      .map(z => ({ type: "Feature", properties: { zone_name: z.name, risk_state: "BREACHED" }, geometry: { type: "Polygon", coordinates: z.polygon_coordinates } }))
  };
};
export const runLocalMarineTelemetry = () => {
  return survivalData.mock_ocean_anomalies.map(anomaly => ({
    type: "Feature",
    properties: {
      location_name: anomaly.name,
      surface_temp_anomaly_celsius: anomaly.temp_anomaly,
      microplastic_density_ppm: anomaly.plastic_density,
      ai_watchdog_status: anomaly.temp_anomaly > 2.8 ? "CRITICAL" : "MONITOR"
    },
    geometry: { type: "Point", coordinates: anomaly.coordinates }
  }));
};