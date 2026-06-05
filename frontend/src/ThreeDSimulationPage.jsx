import React, { useState, useEffect } from 'react';
import Map, { Source, Layer } from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || '';

export default function ThreeDSimulationPage({ geoData, simulationArgs, currentTimeStep = 0 }) {
  const [mapRef, setMapRef] = React.useState(null);

  // This effect injects 3D buildings natively from Mapbox streets and floods them!
  useEffect(() => {
    if (!mapRef) return;
    const map = mapRef.getMap();

    // Check if the 3D building layer already exists, if not, add it
    if (!map.getLayer('3d-buildings')) {
      map.addLayer({
        id: '3d-buildings',
        source: 'composite',
        'source-layer': 'building',
        filter: ['==', 'extrude', 'true'],
        type: 'fill-extrusion',
        minzoom: 11,
        paint: {
          'fill-extrusion-base': ['get', 'min_height'],
          'fill-extrusion-height': ['get', 'height'],
          'fill-extrusion-opacity': 0.85
        }
      });
    }

    // As currentTimeStep increases, the city structures turn from slate gray to deep flood cyan.
    const floodProgress = currentTimeStep / 11;
    map.setPaintProperty('3d-buildings', 'fill-extrusion-color', [
      'interpolate', ['linear'], ['literal', floodProgress],
      0, '#475569', // Step 0: Normal slate-gray buildings (Dry)
      0.5, '#0891b2', // Step 6: Water rising, turning cyan
      1, '#2563eb'   // Step 11: Severe immersion (Deep flood blue)
    ]);

  }, [mapRef, currentTimeStep]);

  return (
    <div className="w-full h-full relative">
      <Map
        ref={setMapRef}
        initialViewState={{
          longitude: -76.78, // Centered directly on Kingston
          latitude: 17.95,
          zoom: 13,          // Zoomed closer to see city buildings clearly
          pitch: 60,         // Tilted high to show off the 3D structure heights
          bearing: -20
        }}
        mapboxAccessToken={MAPBOX_TOKEN}
        mapStyle="mapbox://styles/mapbox/satellite-streets-v12"
        style={{ width: '100%', height: '100%' }}
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

        {/* Airport/Infrastructure specific vector overlays if present */}
        {geoData && geoData.features && geoData.features.length > 0 && (
          <Source id="simulation-inundation-source" type="geojson" data={geoData}>
            <Layer 
              id="airport-overlay"
              type="fill-extrusion"
              paint={{
                'fill-extrusion-color': '#06b6d4',
                'fill-extrusion-opacity': currentTimeStep === 0 ? 0 : 0.7,
                'fill-extrusion-height': ['coalesce', ['get', 'height_meters'], 3],
                'fill-extrusion-base': 0
              }}
            />
          </Source>
        )}
      </Map>
    </div>
  );
}