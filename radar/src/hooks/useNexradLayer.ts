// MapLibre image source for the NOAA mapservices NEXRAD reflectivity
// product. Always mounted; opacity is controlled by useRadarStack so we
// can crossfade with Windy on zoom changes without unmounting (which
// would re-fetch tiles and flicker).
//
// On every settled map move (debounced 500ms) we recompute the viewport
// bbox and updateImage so the proxy fetches a fresh ImageServer render
// for that footprint and timestamp.

import maplibregl from 'maplibre-gl';
import { useEffect } from 'react';
import { debounce } from '../lib/debounce';

export const NEXRAD_SOURCE_ID = 'nexrad-overlay';
export const NEXRAD_LAYER_ID = 'nexrad-overlay-layer';

interface Args {
  map: maplibregl.Map | null;
  /** Active timestamp in epoch milliseconds (for the time= ImageServer param). */
  time: number;
  /** Optional product param hook for future products served by the same
   *  proxy (composite reflectivity, echo tops, …). Today the proxy points
   *  exclusively at radar_base_reflectivity_time. */
  product?: string;
}

function bboxFromMap(map: maplibregl.Map) {
  const b = map.getBounds();
  const bbox = [
    b.getWest(),
    b.getSouth(),
    b.getEast(),
    b.getNorth(),
  ].join(',');
  const coords: [
    [number, number],
    [number, number],
    [number, number],
    [number, number],
  ] = [
    [b.getWest(), b.getNorth()],
    [b.getEast(), b.getNorth()],
    [b.getEast(), b.getSouth()],
    [b.getWest(), b.getSouth()],
  ];
  return { bbox, coords };
}

export function useNexradLayer({ map, time, product = 'refl' }: Args) {
  useEffect(() => {
    if (!map) return;

    const apply = () => {
      const { bbox, coords } = bboxFromMap(map);
      const url = `/api/radar/nexrad?bbox=${encodeURIComponent(
        bbox,
      )}&size=2048,2048&time=${time}&product=${product}`;

      const existing = map.getSource(NEXRAD_SOURCE_ID) as
        | maplibregl.ImageSource
        | undefined;

      if (existing) {
        existing.updateImage({ url, coordinates: coords });
        return;
      }

      map.addSource(NEXRAD_SOURCE_ID, {
        type: 'image',
        url,
        coordinates: coords,
      });
      map.addLayer({
        id: NEXRAD_LAYER_ID,
        type: 'raster',
        source: NEXRAD_SOURCE_ID,
        paint: {
          'raster-opacity': 0,
          'raster-fade-duration': 400,
          'raster-resampling': 'linear',
        },
      });
    };

    const debounced = debounce(apply, 500);

    const onLoadOnce = () => apply();

    if (map.isStyleLoaded()) apply();
    else map.once('load', onLoadOnce);

    map.on('moveend', debounced);

    return () => {
      map.off('moveend', debounced);
      map.off('load', onLoadOnce);
      debounced.cancel();
    };
  }, [map, time, product]);
}
