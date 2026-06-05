import React, { useState } from 'react';
import Map, { Source, Layer } from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || '';

// 3D Vector Water configuration
const extrusionLayerStyle = {
  id: 'inundation-3d-layer',
  type: 'fill-extrusion',
  paint: {
    'fill-extrusion-color': '#3b82f6',
    'fill-extrusion-opacity': 0.6,
    'fill-extrusion-height': ['coalesce', ['get', 'depth_meters'], 1.5], 
    'fill-extrusion-base': 0
  }
};

export default function ThreeDSimulationPage({ geoData, simulationArgs, currentTimeStep = 0 }) {
  const [mapLoaded, setMapLoaded] = useState(false);

  // Dynamic style calculation tied to the timeline slider
  const rasterFloodLayerStyle = {
    id: 'jamaica-raster-flood-layer',
    type: 'raster',
    paint: {
      // 1. Isolate the binary values: 0 (dry land) is hidden, 1 (flooded) gets a neon cyan tint
      'raster-color': [
        'interpolate', ['linear'], ['raster-value'],
        0, 'rgba(0, 0, 0, 0)',
        1, 'rgba(6, 182, 212, 0.8)' 
      ],
      'raster-color-range': [0, 1],

      // 2. Dynamic Opacity Engine: Maps the 0-11 step timeline linearly to visibility
      'raster-opacity': currentTimeStep === 0 
        ? 0 
        : (currentTimeStep / 11) * 0.85,

      'raster-fade-duration': 300,
      'raster-resampling': 'nearest'
    }
  };

  return (
    <div className="w-full h-full relative">
      <Map
        initialViewState={{
          longitude: -77.2975, 
          latitude: 18.1096,
          zoom: 8.5,           
          pitch: 50,           
          bearing: 0
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

        {/* Ingest and map Jamaica Flood TIFF */}
        {mapLoaded && (
          <Source
            id="jamaica-flood-raster-source"
            type="raster"
            tiles={[
              `${window.location.origin}/layers/jamaica_flood_zone.tif`
            ]}
            tileSize={256}
          >
            {/* re-evaluate style when currentTimeStep changes */}
            <Layer {...rasterFloodLayerStyle} />
          </Source>
        )}

        {/*Render 3D vector features if passed into data fields */}
        {mapLoaded && geoData && geoData.features && (
          <Source id="simulation-inundation-source" type="geojson" data={geoData}>
            <Layer {...extrusionLayerStyle} />
          </Source>
        )}
      </Map>
    </div>
  );
}