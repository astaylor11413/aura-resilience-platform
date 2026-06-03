import React, { useState, useEffect } from 'react';
import Map, { Source, Layer } from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || '';

// 3D Water extrusion style configuration
const extrusionLayerStyle = {
  id: 'inundation-3d-layer',
  type: 'fill-extrusion',
  paint: {
    'fill-extrusion-color': '#3b82f6',
    'fill-extrusion-opacity': 0.6,
    // Physically lift the water polygon using the SLR meters argument
    'fill-extrusion-height': ['coalesce', ['get', 'depth_meters'], 1.5], 
    'fill-extrusion-base': 0
  }
};

export default function ThreeDSimulationPage({ simulationArgs }) {
  const [mapLoaded, setMapLoaded] = useState(false);
  const [geoData, setGeoData] = useState(null);

  // Safely fetch or generate your simulation layers when the component mounts
  useEffect(() => {
    // For fetching simulation data via API endpoints:
    fetch(`https://aura-resilience-platform-qa.onrender.com/api/v1/hazard/inundation?slr_meters=${simulationArgs.slrMeters}`)
      .then(res => res.json())
      .then(data => setGeoData(data))
      .catch(err => console.error("Failed to load 3D simulation data layers:", err));
  }, [simulationArgs.slrMeters]);

  return (
    <div className="w-full h-full relative">
      <Map
        initialViewState={{
          longitude: -76.78,
          latitude: 17.95,
          zoom: 12.5,
          pitch: 60, // Tilted perspective to visualize 3D topography
          bearing: -20
        }}
        mapboxAccessToken={MAPBOX_TOKEN}
        mapStyle="mapbox://styles/mapbox/satellite-streets-v12"
        style={{ width: '100%', height: '100%' }}
        onStyleData={() => setMapLoaded(true)}
        terrain={{ source: 'mapbox-dem', exaggeration: 1.2 }}
      >
        {/* Elevation Mesh Source */}
        <Source
          id="mapbox-dem"
          type="raster-dem"
          url="mapbox://mapbox.mapbox-terrain-dem-v1"
          tileSize={256}
          maxzoom={14}
        />

        {/* Render 3D data layers only when the style canvas AND data properties are fully ready */}
        {mapLoaded && geoData && (
          <Source id="simulation-inundation-source" type="geojson" data={geoData}>
            <Layer {...extrusionLayerStyle} />
          </Source>
        )}
      </Map>
    </div>
  );
}