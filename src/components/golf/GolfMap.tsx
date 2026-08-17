// Satellite hole view: hole paths, drawn wind streamlines, and the predicted
// wind-bent shot path for the selected hole.

import { useCallback, useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { GOLF_SATELLITE_STYLE, type GolfHole } from '../../lib/golf';
import {
  emptyCollection,
  shotPathGeoJSON,
  windFlowGeoJSON,
} from '../../lib/golfWind';
import { bearingCompass } from '../../lib/geo';

interface Props {
  lat: number;
  lon: number;
  holes: GolfHole[];
  activeHole: number | null;
  onSelectHole?: (n: number) => void;
  windFromDeg?: number | null;
  windMph?: number | null;
  headwindMph?: number | null;
  crosswindMph?: number | null;
  /** Rotate the map so the active hole plays up the screen. */
  holeUp?: boolean;
  className?: string;
}

const SRC = 'golf-holes';
const SRC_TEE = 'golf-tees';
const SRC_GREEN = 'golf-greens';
const SRC_FLOW = 'golf-wind-flow';
const SRC_SHOT = 'golf-shot-path';

const LINE = 'golf-hole-lines';
const LINE_ACTIVE = 'golf-hole-lines-active';
const LYR_TEE = 'golf-tees-lyr';
const LYR_GREEN = 'golf-greens-lyr';
const LYR_FLOW = 'golf-wind-flow-lyr';
const LYR_FLOW_ARROW = 'golf-wind-arrow-lyr';
const LYR_AIM = 'golf-aim-lyr';
const LYR_DRIFT = 'golf-drift-lyr';
const LYR_LANDING = 'golf-landing-lyr';

// Marching-ants cycle for the streamlines.
const DASH_STEPS: Array<[number, number, number, number]> = [
  [0, 4, 3, 0],
  [0.5, 4, 2.5, 0.5],
  [1, 4, 2, 1],
  [1.5, 4, 1.5, 1.5],
  [2, 4, 1, 2],
  [2.5, 4, 0.5, 2.5],
  [3, 4, 0, 3],
];

function holesGeoJSON(holes: GolfHole[], active: number | null) {
  return {
    type: 'FeatureCollection' as const,
    features: holes.map((h) => {
      const path = h.path?.length
        ? h.path.map((p) => [p.lon, p.lat] as [number, number])
        : [
            [h.tee.lon, h.tee.lat] as [number, number],
            [h.green.lon, h.green.lat] as [number, number],
          ];
      return {
        type: 'Feature' as const,
        properties: {
          number: h.number,
          active: active === h.number ? 1 : 0,
          yards: h.yards,
          bearing: h.bearingDeg,
        },
        geometry: { type: 'LineString' as const, coordinates: path },
      };
    }),
  };
}

function pointsGeoJSON(holes: GolfHole[], kind: 'tee' | 'green') {
  return {
    type: 'FeatureCollection' as const,
    features: holes.map((h) => {
      const pt = kind === 'tee' ? h.tee : h.green;
      return {
        type: 'Feature' as const,
        properties: { number: h.number, kind },
        geometry: {
          type: 'Point' as const,
          coordinates: [pt.lon, pt.lat] as [number, number],
        },
      };
    }),
  };
}

export function GolfMap({
  lat,
  lon,
  holes,
  activeHole,
  onSelectHole,
  windFromDeg,
  windMph,
  headwindMph,
  crosswindMph,
  holeUp = true,
  className = '',
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const readyRef = useRef(false);
  const queueRef = useRef<Array<() => void>>([]);
  const onSelectRef = useRef(onSelectHole);
  onSelectRef.current = onSelectHole;

  // Layers only exist after `load`, so defer any data/camera work until then.
  const whenReady = useCallback((fn: () => void) => {
    if (readyRef.current) fn();
    else queueRef.current.push(fn);
  }, []);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: GOLF_SATELLITE_STYLE as maplibregl.StyleSpecification,
      center: [lon, lat],
      zoom: 15.2,
      attributionControl: { compact: true },
    });
    map.addControl(
      new maplibregl.NavigationControl({ visualizePitch: false }),
      'top-right',
    );
    mapRef.current = map;

    const onLoad = () => {
      map.addSource(SRC, { type: 'geojson', data: holesGeoJSON([], null) });
      map.addSource(SRC_TEE, {
        type: 'geojson',
        data: pointsGeoJSON([], 'tee'),
      });
      map.addSource(SRC_GREEN, {
        type: 'geojson',
        data: pointsGeoJSON([], 'green'),
      });
      map.addSource(SRC_FLOW, { type: 'geojson', data: emptyCollection() });
      map.addSource(SRC_SHOT, { type: 'geojson', data: emptyCollection() });

      map.addLayer({
        id: LINE,
        type: 'line',
        source: SRC,
        filter: ['==', ['get', 'active'], 0],
        paint: {
          'line-color': '#f8fafc',
          'line-width': 2,
          'line-opacity': 0.55,
        },
      });
      map.addLayer({
        id: LINE_ACTIVE,
        type: 'line',
        source: SRC,
        filter: ['==', ['get', 'active'], 1],
        paint: {
          'line-color': '#ffffff',
          'line-width': 3,
          'line-opacity': 0.85,
        },
      });

      // Wind streamlines under the shot path so the ball line stays readable.
      map.addLayer({
        id: LYR_FLOW,
        type: 'line',
        source: SRC_FLOW,
        filter: ['==', ['get', 'kind'], 'flow'],
        paint: {
          'line-color': '#4dd9ff',
          'line-width': 2.4,
          'line-opacity': 0.85,
          'line-dasharray': [0, 4, 3, 0],
          'line-blur': 0.4,
        },
      });
      map.addLayer({
        id: LYR_FLOW_ARROW,
        type: 'line',
        source: SRC_FLOW,
        filter: ['==', ['get', 'kind'], 'arrow'],
        paint: {
          'line-color': '#4dd9ff',
          'line-width': 2.4,
          'line-opacity': 0.95,
        },
      });

      map.addLayer({
        id: LYR_AIM,
        type: 'line',
        source: SRC_SHOT,
        filter: ['==', ['get', 'kind'], 'aim'],
        paint: {
          'line-color': '#e2e8f0',
          'line-width': 1.4,
          'line-opacity': 0.5,
          'line-dasharray': [2, 2],
        },
      });
      map.addLayer({
        id: LYR_DRIFT,
        type: 'line',
        source: SRC_SHOT,
        filter: ['==', ['get', 'kind'], 'drift'],
        paint: {
          'line-color': '#ff8a3d',
          'line-width': 3.4,
          'line-opacity': 0.95,
        },
      });
      map.addLayer({
        id: LYR_LANDING,
        type: 'line',
        source: SRC_SHOT,
        filter: ['==', ['get', 'kind'], 'landing'],
        paint: {
          'line-color': '#ff8a3d',
          'line-width': 3,
          'line-opacity': 0.9,
        },
      });

      map.addLayer({
        id: LYR_TEE,
        type: 'circle',
        source: SRC_TEE,
        paint: {
          'circle-radius': 5,
          'circle-color': '#22c55e',
          'circle-stroke-width': 1.5,
          'circle-stroke-color': '#052e16',
        },
      });
      map.addLayer({
        id: LYR_GREEN,
        type: 'circle',
        source: SRC_GREEN,
        paint: {
          'circle-radius': 6,
          'circle-color': '#f8fafc',
          'circle-stroke-width': 2,
          'circle-stroke-color': '#0f172a',
        },
      });

      const click = (e: maplibregl.MapLayerMouseEvent) => {
        const n = e.features?.[0]?.properties?.number;
        if (typeof n === 'number') onSelectRef.current?.(n);
      };
      for (const id of [LINE, LINE_ACTIVE, LYR_TEE, LYR_GREEN]) {
        map.on('click', id, click);
        map.on('mouseenter', id, () => {
          map.getCanvas().style.cursor = 'pointer';
        });
        map.on('mouseleave', id, () => {
          map.getCanvas().style.cursor = '';
        });
      }

      readyRef.current = true;
      const queued = queueRef.current;
      queueRef.current = [];
      for (const fn of queued) fn();
    };

    map.on('load', onLoad);

    return () => {
      readyRef.current = false;
      queueRef.current = [];
      map.remove();
      mapRef.current = null;
    };
    // Mount once; data updates run in the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Animate the streamlines so the flow direction reads at a glance.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

    let raf = 0;
    let step = 0;
    let last = 0;
    const tick = (now: number) => {
      if (now - last > 90) {
        last = now;
        step = (step + 1) % DASH_STEPS.length;
        if (map.getLayer(LYR_FLOW)) {
          map.setPaintProperty(LYR_FLOW, 'line-dasharray', DASH_STEPS[step]);
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    whenReady(() => {
      (map.getSource(SRC) as maplibregl.GeoJSONSource | undefined)?.setData(
        holesGeoJSON(holes, activeHole),
      );
      (map.getSource(SRC_TEE) as maplibregl.GeoJSONSource | undefined)?.setData(
        pointsGeoJSON(holes, 'tee'),
      );
      (
        map.getSource(SRC_GREEN) as maplibregl.GeoJSONSource | undefined
      )?.setData(pointsGeoJSON(holes, 'green'));
    });
  }, [holes, activeHole, whenReady]);

  // Camera: frame the whole course, or fly down the selected hole.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const hole = holes.find((h) => h.number === activeHole);

    const move = () => {
      if (hole) {
        const mid: [number, number] = [
          (hole.tee.lon + hole.green.lon) / 2,
          (hole.tee.lat + hole.green.lat) / 2,
        ];
        // Longer holes need a wider frame to fit tee through green.
        const zoom =
          hole.yards > 520 ? 15.4 : hole.yards > 380 ? 15.9 : 16.4;
        map.easeTo({
          center: mid,
          zoom,
          bearing: holeUp ? hole.bearingDeg : 0,
          duration: 700,
        });
        return;
      }
      if (holes.length) {
        const b = new maplibregl.LngLatBounds();
        for (const h of holes) {
          b.extend([h.tee.lon, h.tee.lat]);
          b.extend([h.green.lon, h.green.lat]);
        }
        map.easeTo({ bearing: 0, duration: 300 });
        map.fitBounds(b, { padding: 60, maxZoom: 17, duration: 700 });
      } else {
        map.easeTo({ center: [lon, lat], duration: 600 });
      }
    };

    whenReady(move);
    // Course-level recentering is driven by lat/lon; hole framing by activeHole.
  }, [holes, activeHole, holeUp, lat, lon, whenReady]);

  // Wind streamlines + predicted shot path for the selected hole.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const hole = holes.find((h) => h.number === activeHole) ?? null;

    whenReady(() => {
      (
        map.getSource(SRC_FLOW) as maplibregl.GeoJSONSource | undefined
      )?.setData(windFlowGeoJSON(hole, windFromDeg, windMph));
      (
        map.getSource(SRC_SHOT) as maplibregl.GeoJSONSource | undefined
      )?.setData(shotPathGeoJSON(hole, crosswindMph, headwindMph));
    });
  }, [
    holes,
    activeHole,
    windFromDeg,
    windMph,
    headwindMph,
    crosswindMph,
    whenReady,
  ]);

  const windLabel =
    windFromDeg != null
      ? `Wind ${windMph != null ? `${Math.round(windMph)} mph ` : ''}from ${Math.round(windFromDeg)}° ${bearingCompass(windFromDeg)}`
      : null;

  return (
    <div className={`relative h-full w-full overflow-hidden ${className}`}>
      <div ref={containerRef} className="absolute inset-0" />
      {windLabel && (
        <div className="pointer-events-none absolute left-3 top-3 flex flex-col gap-1 rounded-lg bg-black/55 px-2.5 py-1.5 text-[11px] font-medium backdrop-blur-md ring-1 ring-white/10">
          <span className="text-cyan-200">{windLabel}</span>
          {activeHole != null && (
            <span className="flex items-center gap-1.5 text-[10px] text-[var(--ink-3)]">
              <span className="inline-block h-0.5 w-4 rounded bg-cyan-300" />
              wind flow
              <span className="ml-1 inline-block h-0.5 w-4 rounded bg-[#ff8a3d]" />
              ball path
            </span>
          )}
        </div>
      )}
    </div>
  );
}
