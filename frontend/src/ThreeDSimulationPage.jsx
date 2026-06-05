import React, { useState } from 'react';
import Map, { Source, Layer } from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || '';

export default function ThreeDSimulationPage({ geoData, simulationArgs, currentTimeStep = 0 }) {
  const [mapLoaded, setMapLoaded] = useState(false);

  // Styling rules for our sequential shoreline flooding bands
  const shorelineSurgeStyle = {
    id: 'kingston-gradual-shoreline',
    type: 'fill-extrusion',
    paint: {
      'fill-extrusion-color': '#06b6d4',
      'fill-extrusion-opacity': 0.6,
      'fill-extrusion-height': (currentTimeStep / 11) * 4.5,
      'fill-extrusion-base': 0
    }
  };

  // Breaking Kingston into 6 individual shoreline bands
  const gradualKingstonGrid = {
    type: "FeatureCollection",
    features: [
      // Band 1: Deep water edge - Floods immediately at Step 1
      ...(currentTimeStep >= 1 ? [{ type: "Feature", geometry: { type: "Polygon", coordinates: [[[-76.84, 17.925], [-76.73, 17.925], [-76.73, 17.935], [-76.84, 17.935], [-76.84, 17.925]]] } }] : []),
      // Band 2: Port/Harbor line - Floods at Step 3
      ...(currentTimeStep >= 3 ? [{ type: "Feature", geometry: { type: "Polygon", coordinates: [[[-76.84, 17.935], [-76.73, 17.935], [-76.73, 17.945], [-76.84, 17.945], [-76.84, 17.935]]] } }] : []),
      // Band 3: Waterfront Drive - Floods at Step 5
      ...(currentTimeStep >= 5 ? [{ type: "Feature", geometry: { type: "Polygon", coordinates: [[[-76.84, 17.945], [-76.73, 17.945], [-76.73, 17.955], [-76.84, 17.955], [-76.84, 17.945]]] } }] : []),
      // Band 4: Downtown Lower Grid - Floods at Step 7
      ...(currentTimeStep >= 7 ? [{ type: "Feature", geometry: { type: "Polygon", coordinates: [[[-76.84, 17.955], [-76.73, 17.955], [-76.73, 17.965], [-76.84, 17.965], [-76.84, 17.955]]] } }] : []),
      // Band 5: Mid-City Commercial Blocks - Floods at Step 9
      ...(currentTimeStep >= 9 ? [{ type: "Feature", geometry: { type: "Polygon", coordinates: [[[-76.84, 17.965], [-76.73, 17.965], [-76.73, 17.975], [-76.84, 17.975], [-76.84, 17.965]]] } }] : []),
      // Band 6: Inland Inland Infrastructure - Floods only at Step 11 (Peak Storm)
      ...(currentTimeStep >= 11 ? [{ type: "Feature", geometry: { type: "Polygon", coordinates: [[[-76.84, 17.975], [-76.73, 17.975], [-76.73, 17.985], [-76.84, 17.985], [-76.84, 17.975]]] } }] : [])
    ]
  };

  return (
    <div className="w-full h-full relative">
      <Map
        initialViewState={{
          longitude: -76.78,
          latitude: 17.95,
          zoom: 11.5,
          pitch: 45,
          bearing: -10
        }}
        mapboxAccessToken={MAPBOX_TOKEN}
        mapStyle="mapbox://styles/mapbox/satellite-streets-v12"
        style={{ width: '100%', height: '100%' }}
        onStyleData={() => setMapLoaded(true)}
        terrain={{ source: 'mapbox-dem', exaggeration: 1.2 }}
      >
        <Source id="mapbox-dem" type="raster-dem" url="mapbox://mapbox.mapbox-terrain-dem-v1" tileSize={256} maxzoom={14} />

        {/* 1. The Airport Strip */}
        {mapLoaded && geoData && geoData.features && (
          <Source id="airport-source" type="geojson" data={geoData}>
            <Layer
              id="airport-structures-layer"
              type="fill-extrusion"
              paint={{
                'fill-extrusion-color': '#06b6d4',
                'fill-extrusion-opacity': currentTimeStep === 0 ? 0 : 0.75,
                'fill-extrusion-height': ['coalesce', ['get', 'height_meters'], 4],
                'fill-extrusion-base': 0
              }}
            />
          </Source>
        )}

        {/* 2. Downtown Kingston gradual flood */}
        {mapLoaded && (
          <Source id="kingston-simulated-source" type="geojson" data={gradualKingstonGrid}>
            <Layer {...shorelineSurgeStyle} />
          </Source>
        )}
      </Map>
    </div>
  );
}