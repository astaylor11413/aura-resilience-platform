import React, { useState } from 'react';
import Map, { Source, Layer } from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || '';

export default function ThreeDSimulationPage({ geoData, simulationArgs, currentTimeStep = 0 }) {
  const [mapLoaded, setMapLoaded] = useState(false);
  
  const dynamicStructuralFloodLayer = {
    id: 'kingston-gradual-flood-layer',
    type: 'fill-extrusion',
    paint: {
      // As the timeline moves forward, buildings gradually transition from nominal blue to severe red
      'fill-extrusion-color': [
        'match',
        ['layer', 'id'], // Baseline catcher
        'kingston-gradual-flood-layer', 
        currentTimeStep > 8 
          ? '#f43f5e' // Step 9-11: Severe Breach (Crimson)
          : currentTimeStep > 4 
            ? '#fb923c' // Step 5-8: Active Inundation (Orange)
            : '#38bdf8', // Step 0-4: Nominal/Initial Surge (Cyan)
        '#38bdf8'
      ],
      // Physically raise the 3D structures on the terrain map
      'fill-extrusion-height': ['coalesce', ['get', 'height_meters'], 8],
      'fill-extrusion-base': 0,
      'fill-extrusion-opacity': currentTimeStep === 0 ? 0.2 : 0.9
    }
  };

  // Localized, high-density coordinate grid replicating Kingston's waterfront development clusters
  const simulatedKingstonWaterfrontStructures = {
    type: "FeatureCollection",
    features: [
      { type: "Feature", properties: { height_meters: 25 }, geometry: { type: "Polygon", coordinates: [[[-76.791, 17.965], [-76.789, 17.965], [-76.789, 17.967], [-76.791, 17.967], [-76.791, 17.965]]] } },
      { type: "Feature", properties: { height_meters: 14 }, geometry: { type: "Polygon", coordinates: [[[-76.787, 17.963], [-76.785, 17.963], [-76.785, 17.965], [-76.787, 17.965], [-76.787, 17.963]]] } },
      { type: "Feature", properties: { height_meters: 32 }, geometry: { type: "Polygon", coordinates: [[[-76.783, 17.962], [-76.781, 17.962], [-76.781, 17.964], [-76.783, 17.964], [-76.783, 17.962]]] } },
      { type: "Feature", properties: { height_meters: 8 }, geometry: { type: "Polygon", coordinates: [[[-76.779, 17.966], [-76.777, 17.966], [-76.777, 17.968], [-76.779, 17.968], [-76.779, 17.966]]] } },
      { type: "Feature", properties: { height_meters: 19 }, geometry: { type: "Polygon", coordinates: [[[-76.775, 17.961], [-76.773, 17.961], [-76.773, 17.963], [-76.775, 17.963], [-76.775, 17.961]]] } }
    ]
  };

  // Compile datasets
  const activeStructureData = geoData && geoData.features && geoData.features.length > 0
    ? geoData
    : simulatedKingstonWaterfrontStructures;

  return (
    <div className="w-full h-full relative">
      <Map
        initialViewState={{
          longitude: -76.785, // Centered right over Kingston Waterfront clusters
          latitude: 17.964,
          zoom: 13.5,         // High altitude focus to observe individual building assets
          pitch: 60,          // Distinct 3D angle view
          bearing: -15
        }}
        mapboxAccessToken={MAPBOX_TOKEN}
        mapStyle="mapbox://styles/mapbox/satellite-streets-v12"
        style={{ width: '100%', height: '100%' }}
        onStyleData={() => setMapLoaded(true)}
        terrain={{ source: 'mapbox-dem', exaggeration: 1.5 }}
      >
        {/* Elevation Mesh Source */}
        <Source
          id="mapbox-dem"
          type="raster-dem"
          url="mapbox://mapbox.mapbox-terrain-dem-v1"
          tileSize={256}
          maxzoom={14}
        />

        {mapLoaded && (
          <Source id="simulation-structural-source" type="geojson" data={activeStructureData}>
            <Layer {...dynamicStructuralFloodLayer} />
          </Source>
        )}
      </Map>
    </div>
  );
}