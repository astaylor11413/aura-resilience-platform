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
  return (
    <div className="w-full h-full relative">
      <Map
        initialViewState={{
          longitude: -76.78, // Centered right on Kingston Harbor
          latitude: 17.95,
          zoom: 11.5,        // Zoomed in close enough to see streets and coastlines
          pitch: 55,
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
            <Layer
              id="jamaica-raster-flood-layer"
              type="raster"
              paint={{
                //TEST: Bypass data cell reading and fade the entire file straight in/out
                'raster-opacity': currentTimeStep === 0
                  ? 0
                  : (currentTimeStep / 11) * 0.85,

                'raster-fade-duration': 100
              }}
            />
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