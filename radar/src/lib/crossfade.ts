import type maplibregl from 'maplibre-gl';

// Toggle a layer's raster-opacity over the configured duration. MapLibre
// interpolates paint properties automatically once we set them, so the
// helper just guards against missing layers + clamps to [0,1].
export function fadeRasterTo(
  map: maplibregl.Map,
  layerId: string,
  target: number,
): void {
  if (!map.getLayer(layerId)) return;
  map.setPaintProperty(layerId, 'raster-opacity', Math.max(0, Math.min(1, target)));
}
