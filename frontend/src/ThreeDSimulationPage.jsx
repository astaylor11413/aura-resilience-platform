import React, { useState } from 'react';
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
    // Physically lift the water polygon using the SLR meters argument or properties
    'fill-extrusion-height': ['coalesce', ['get', 'depth_meters'], 1.5], 
    'fill-extrusion-base': 0
  }
};

export default function ThreeDSimulationPage({ geoData }) {
  const [mapLoaded, setMapLoaded] = useState(false);

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
        {mapLoaded && geoData && geoData.features && (
          <Source id="simulation-inundation-source" type="geojson" data={geoData}>
            <Layer {...extrusionLayerStyle} />
          </Source>
        )}
      </Map>
    </div>
  );
}