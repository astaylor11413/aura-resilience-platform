import React, { useState } from 'react';
import Map, { Source, Layer } from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || '';

export default function ThreeDSimulationPage({ geoData, simulationArgs, currentTimeStep = 0 }) {
  const [mapLoaded, setMapLoaded] = useState(false);

  // 3D Vector Water extrusion configuration (Dynamic Height + Opacity)
  const extrusionLayerStyle = {
    id: 'inundation-3d-layer',
    type: 'fill-extrusion',
    paint: {
      // Sleek neon cyan water color matching your AURA UI theme
      'fill-extrusion-color': '#06b6d4', 
      
      // Gradually increases opacity as the storm builds
      'fill-extrusion-opacity': currentTimeStep === 0 ? 0 : 0.65,
      
      // DYNAMIC HEIGHT: Physically grows the water upwards on the 3D terrain mesh!
      'fill-extrusion-height': currentTimeStep === 0 
        ? 0 
        : (currentTimeStep / 11) * 4.5, // Climbs up to a 4.5m max storm surge
        
      'fill-extrusion-base': 0
    }
  };

  // Safe sample shoreline boundary polygon for Kingston if geoData is missing
  const fallbackKingstonWaterGeoJson = {
    type: "FeatureCollection",
    features: [{
      type: "Feature",
      properties: { name: "Kingston Harbor Inundation Zone" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [-76.83, 17.93],
          [-76.75, 17.93],
          [-76.74, 17.97],
          [-76.81, 17.98],
          [-76.83, 17.93]
        ]]
      }
    }]
  };

  return (
    <div className="w-full h-full relative">
      <Map
        initialViewState={{
          longitude: -76.78, // Centered directly on Kingston Harbor
          latitude: 17.95,
          zoom: 11.5,        // Tight zoom to show infrastructure impact
          pitch: 55,         // Angled to showcase the 3D building/terrain extrusions
          bearing: -10
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

        {/* Dynamic 3D Vector Inundation Layer */}
        {mapLoaded && (
          <Source 
            id="simulation-inundation-source" 
            type="geojson" 
            data={geoData && geoData.features && geoData.features.length > 0 ? geoData : fallbackKingstonWaterGeoJson}
          >
            <Layer {...extrusionLayerStyle} />
          </Source>
        )}
      </Map>
    </div>
  );
}