// Opacity-based crossfade between the always-mounted Windy and NEXRAD
// layers. Both layers stay subscribed to their tile/image sources so
// MapLibre's internal raster-fade-duration handles in-layer transitions
// while we drive the inter-layer crossfade through paint property tweaks.

import maplibregl from 'maplibre-gl';
import { useEffect, useState } from 'react';
import { NEXRAD_LAYER_ID } from './useNexradLayer';
import { WINDY_LAYER_ID } from './useWindyLayer';

interface CrossfadeStops {
  windy: number;
  nexrad: number;
}

// Linear ramp through the crossfade band so both layers are partially
// visible during the transition (zoom 7-8). Anything < 7 is Windy only;
// anything ≥ 8 is NEXRAD only.
export function pickStops(zoom: number): CrossfadeStops {
  if (zoom < 7) return { windy: 0.78, nexrad: 0 };
  if (zoom >= 8) return { windy: 0, nexrad: 0.85 };
  const t = zoom - 7; // 0..1
  return {
    windy: 0.78 * (1 - t),
    nexrad: 0.85 * t,
  };
}

export function useRadarStack(map: maplibregl.Map | null): number {
  const [zoom, setZoom] = useState(() => map?.getZoom() ?? 4);

  useEffect(() => {
    if (!map) return;
    const onZoom = () => setZoom(map.getZoom());
    map.on('zoom', onZoom);
    return () => {
      map.off('zoom', onZoom);
    };
  }, [map]);

  useEffect(() => {
    if (!map) return;
    const apply = () => {
      const { windy, nexrad } = pickStops(zoom);
      if (map.getLayer(WINDY_LAYER_ID)) {
        map.setPaintProperty(WINDY_LAYER_ID, 'raster-opacity', windy);
      }
      if (map.getLayer(NEXRAD_LAYER_ID)) {
        map.setPaintProperty(NEXRAD_LAYER_ID, 'raster-opacity', nexrad);
      }
    };
    if (map.isStyleLoaded()) apply();
    else map.once('idle', apply);
  }, [map, zoom]);

  return zoom;
}
