import React, { useState } from 'react';
import Map, { Source, Layer } from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || '';

// 3D Vector Water extrusion configuration
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

// Raster styling overlay for generated GeoTIFF
const rasterFloodLayerStyle = {
  id: 'jamaica-raster-flood-layer',
  type: 'raster',
  paint: {
    // 0.65 opacity gives an unobstructed look at underlying buildings/infrastructure
    'raster-opacity': 0.65,
    // Sharpens the binary cells from python raster output
    'raster-resampling': 'nearest'
  }
};

export default function ThreeDSimulationPage({ geoData, simulationArgs }) {
  const [mapLoaded, setMapLoaded] = useState(false);

  return (
    <div className="w-full h-full relative">
      <Map
        initialViewState={{
          longitude: -77.2975, // Shifted slightly to center the whole island matrix
          latitude: 18.1096,
          zoom: 8.5,           // Pulled back to encompass full regional scope
          pitch: 50,           // Tilted for topographic visualization
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
            <Layer {...rasterFloodLayerStyle} />
          </Source>
        )}

        {/* Existing: Render 3D vector features if passed into data fields */}
        {mapLoaded && geoData && geoData.features && (
          <Source id="simulation-inundation-source" type="geojson" data={geoData}>
            <Layer {...extrusionLayerStyle} />
          </Source>
        )}
      </Map>
    </div>
  );
}