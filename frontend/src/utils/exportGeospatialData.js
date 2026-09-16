export const triggerDataDownload = (data, filename, format = 'geojson') => {
  let content = '';
  let mimeType = 'application/geo+json';

  if (format === 'stac') {
    // Wrap active features into a STAC Item Collection
    const stacCatalog = {
      type: "FeatureCollection",
      stac_version: "1.0.0",
      description: "Aura Climate Resilience STAC Export",
      features: data.map(feature => ({
        type: "Feature",
        stac_version: "1.0.0",
        id: `aura-${feature.properties.id || Math.random().toString(36).substr(2, 9)}`,
        geometry: feature.geometry,
        bbox: [...feature.geometry.coordinates, ...feature.geometry.coordinates],
        properties: {
          datetime: new Date().toISOString(),
          ...Object.keys(feature.properties).reduce((acc, key) => {
            acc[`aura:${key}`] = feature.properties[key];
            return acc;
          }, {})
        },
        links: [],
        assets: {}
      }))
    };
    content = JSON.stringify(stacCatalog, null, 2);
    mimeType = 'application/json';
  } else {
    const geoJsonCollection = {
      type: "FeatureCollection",
      features: data
    };
    content = JSON.stringify(geoJsonCollection, null, 2);
  }

  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}_${new Date().toISOString().slice(0, 10)}.${format}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};