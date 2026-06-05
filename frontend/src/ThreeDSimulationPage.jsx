import React, { useState } from 'react';
import Map, { Source, Layer } from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || '';

export default function ThreeDSimulationPage({ geoData, simulationArgs, currentTimeStep = 0 }) {
  const [mapLoaded, setMapLoaded] = useState(false);

  // Phase 1: Early Surge (Steps 1-4) - Light Cyan Boundary
  const earlySurgeLayer = {
    id: 'surge-phase-early',
    type: 'fill-extrusion',
    paint: {
      'fill-extrusion-color': '#22d3ee',
      'fill-extrusion-opacity': 0.5,
      'fill-extrusion-height': 1.5,
      'fill-extrusion-base': 0
    }
  };

  // Phase 2: Moderate Inundation (Steps 5-8) - Deepening Blue, Rising Higher
  const midSurgeLayer = {
    id: 'surge-phase-mid',
    type: 'fill-extrusion',
    paint: {
      'fill-extrusion-color': '#0284c7',
      'fill-extrusion-opacity': 0.65,
      'fill-extrusion-height': 3.0,
      'fill-extrusion-base': 0
    }
  };

  // Phase 3: Severe Breach (Steps 9-11) - Dark Emergency Color at Maximum Height
  const peakSurgeLayer = {
    id: 'surge-phase-peak',
    type: 'fill-extrusion',
    paint: {
      'fill-extrusion-color': '#1e40af',
      'fill-extrusion-opacity': 0.8,
      'fill-extrusion-height': 5.0,
      'fill-extrusion-base': 0
    }
  };

  // Geographic boundary shape for Kingston Waterfront + Airport Strip
  const spatialInundationPolygon = {
    type: "FeatureCollection",
    features: [{
      type: "Feature",
      properties: { region: "Kingston Inundation Zone" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [-76.840, 17.925],
          [-76.735, 17.925],
          [-76.735, 17.985],
          [-76.840, 17.985],
          [-76.840, 17.925]
        ]]
      }
    }]
  };

  return (
    <div className="w-full h-full relative">
      <Map
        initialViewState={{
          longitude: -76.78, // Perfect overview of Kingston & Airport Strip
          latitude: 17.95,
          zoom: 11.5,        
          pitch: 50,
          bearing: -10
        }}
        mapboxAccessToken={MAPBOX_TOKEN}
        mapStyle="mapbox://styles/mapbox/satellite-streets-v12"
        style={{ width: '100%', height: '100%' }}
        onStyleData={() => setMapLoaded(true)}
        terrain={{ source: 'mapbox-dem', exaggeration: 1.2 }}
      >
        {/* Terrain Elevation Engine */}
        <Source
          id="mapbox-dem"
          type="raster-dem"
          url="mapbox://mapbox.mapbox-terrain-dem-v1"
          tileSize={256}
          maxzoom={14}
        />

        {/*Conditional Layer Pipeline */}
        {mapLoaded && (
          <Source id="kingston-surge-source" type="geojson" data={spatialInundationPolygon}>
            
            {/* Step 0: Everything is completely dry */}
            {currentTimeStep === 0 && null}

            {/* Steps 1-4: Render initial shoreline surge creeping in */}
            {currentTimeStep >= 1 && currentTimeStep <= 4 && (
              <Layer {...earlySurgeLayer} />
            )}

            {/* Steps 5-8: Water deepens, turns dark cyan, rises higher */}
            {currentTimeStep >= 5 && currentTimeStep <= 8 && (
              <Layer {...midSurgeLayer} />
            )}

            {/* Steps 9-11: Full hurricane peak immersion */}
            {currentTimeStep >= 9 && (
              <Layer {...peakSurgeLayer} />
            )}

          </Source>
        )}
      </Map>
    </div>
  );
}