// Orchestrates the zoom-aware radar layer stack. Watches the active
// SourcePlan and registers the appropriate MapLibre raster source +
// layer, crossfading between them when the plan changes.
//
// PHASE 1 status: Windy fallback path is wired through the proxy URL
// pattern (will 401 until WINDY_KEY is set on the deployed function).
// L3 + L2 sources land in later phases — the hook recognizes them and
// no-ops cleanly so the resolver call site doesn't need conditionals.

import { useEffect, useRef } from 'react';
import type maplibregl from 'maplibre-gl';
import { planKey, type SourcePlan } from '../lib/sourceResolver';

interface Args {
  map: maplibregl.Map | null;
  plan: SourcePlan;
  selectedTime: number; // unix seconds, rounded to 5 min
}

const SOURCE_ID = 'radar-overlay';
const LAYER_ID = 'radar-overlay-layer';

function windyTileUrl(ts: number): string {
  // Edge function proxy. {z}/{x}/{y} are MapLibre placeholders.
  return `/api/radar/windy?ts=${ts}&z={z}&x={x}&y={y}`;
}

export function useRadarLayers({ map, plan, selectedTime }: Args) {
  const lastKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!map) return;
    if (!map.isStyleLoaded()) {
      const onLoad = () => attach();
      map.once('load', onLoad);
      return () => {
        map.off('load', onLoad);
      };
    }
    attach();

    function attach() {
      if (!map) return;
      const key = `${planKey(plan)}|${Math.floor(selectedTime / 300) * 300}`;
      if (key === lastKeyRef.current) return;
      lastKeyRef.current = key;

      // Tear down the previous overlay layer + source.
      if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID);
      if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);

      if (plan.source === 'WINDY') {
        const ts = Math.floor(selectedTime / 300) * 300;
        map.addSource(SOURCE_ID, {
          type: 'raster',
          tiles: [windyTileUrl(ts)],
          tileSize: 256,
          attribution: 'Radar by Windy.com',
        });
        map.addLayer({
          id: LAYER_ID,
          type: 'raster',
          source: SOURCE_ID,
          paint: {
            'raster-opacity': 0,
          },
        });
        // Fade in next frame so the transition triggers.
        requestAnimationFrame(() => {
          if (map.getLayer(LAYER_ID))
            map.setPaintProperty(LAYER_ID, 'raster-opacity', 0.78);
        });
        return;
      }

      // L3 / L2 hookup arrives in Phase 2 / 3. Until then, no overlay.
      // Source resolver still runs so we get the right NEXRAD site stamped
      // on the AlertsInspector + StationInventory hooks.
    }
  }, [map, plan, selectedTime]);
}
