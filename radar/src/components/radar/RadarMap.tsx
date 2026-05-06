import maplibregl from 'maplibre-gl';
import { useEffect, useRef, useState } from 'react';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useRadarLayers } from '../../hooks/useRadarLayers';
import { useAlerts } from '../../hooks/useAlerts';
import { useTimeFrames } from '../../hooks/useTimeFrames';
import { useRadarStore } from '../../store/useRadarStore';

const STYLE_URL = 'https://tiles.openfreemap.org/styles/dark';
const ALERTS_SOURCE = 'nws-alerts';
const ALERTS_FILL = 'nws-alerts-fill';
const ALERTS_LINE = 'nws-alerts-line';
const ALERTS_PULSE = 'nws-alerts-pulse';
const ALERTS_FOCUS = 'nws-alerts-focus';

interface Props {
  onMapReady?: (map: maplibregl.Map) => void;
}

const SEV_COLOR_EXPR: maplibregl.DataDrivenPropertyValueSpecification<string> = [
  'match',
  ['get', 'severity'],
  'extreme',
  '#d946ef',
  'severe',
  '#ef4444',
  'moderate',
  '#f59e0b',
  'minor',
  '#fbbf24',
  '#94a3b8',
];

export function RadarMap({ onMapReady }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [styleLoaded, setStyleLoaded] = useState(false);

  const activeProduct = useRadarStore((s) => s.activeProduct);
  const currentFrameIdx = useRadarStore((s) => s.currentFrameIdx);
  const setMapZoom = useRadarStore((s) => s.setMapZoom);
  const setBbox = useRadarStore((s) => s.setBbox);
  const focusedAlertId = useRadarStore((s) => s.focusedAlertId);
  const focusAlert = useRadarStore((s) => s.focusAlert);

  const frames = useTimeFrames();
  const ts = frames[currentFrameIdx] ?? frames[frames.length - 1];

  const { alerts } = useAlerts();

  // Map setup.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE_URL,
      center: [-95, 39],
      zoom: 4,
      minZoom: 2,
      maxZoom: 14,
      attributionControl: { compact: true },
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

    const updateViewport = () => {
      const b = map.getBounds();
      setMapZoom(map.getZoom());
      setBbox([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]);
    };

    map.on('load', () => {
      setStyleLoaded(true);
      updateViewport();
      onMapReady?.(map);
    });
    map.on('moveend', updateViewport);
    map.on('zoom', () => setMapZoom(map.getZoom()));

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useRadarLayers({
    map: mapRef.current,
    styleLoaded,
    activeProduct,
    ts,
  });

  // Alerts source + layers, kept in sync with the live `alerts` array.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleLoaded) return;

    const features: GeoJSON.Feature[] = alerts
      .filter((a) => a.geometry !== null)
      .map((a) => ({
        type: 'Feature',
        id: a.id,
        properties: {
          id: a.id,
          event: a.event,
          severity: a.severity,
          isTornado: /tornado/i.test(a.event),
        },
        geometry: a.geometry as GeoJSON.Geometry,
      }));
    const collection: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features,
    };

    const existing = map.getSource(ALERTS_SOURCE) as
      | maplibregl.GeoJSONSource
      | undefined;
    if (existing) {
      existing.setData(collection);
      return;
    }

    map.addSource(ALERTS_SOURCE, { type: 'geojson', data: collection });
    map.addLayer({
      id: ALERTS_FILL,
      type: 'fill',
      source: ALERTS_SOURCE,
      paint: { 'fill-color': SEV_COLOR_EXPR, 'fill-opacity': 0.18 },
    });
    map.addLayer({
      id: ALERTS_LINE,
      type: 'line',
      source: ALERTS_SOURCE,
      paint: {
        'line-color': SEV_COLOR_EXPR,
        'line-width': 1.6,
        'line-opacity': 0.95,
      },
    });
    map.addLayer({
      id: ALERTS_PULSE,
      type: 'line',
      source: ALERTS_SOURCE,
      filter: ['==', ['get', 'isTornado'], true],
      paint: {
        'line-color': '#ef4444',
        'line-width': 3,
        'line-blur': 1,
        'line-opacity': 0.85,
      },
    });
    map.addLayer({
      id: ALERTS_FOCUS,
      type: 'line',
      source: ALERTS_SOURCE,
      filter: ['==', ['get', 'id'], '__none__'],
      paint: {
        'line-color': '#ff8a3d',
        'line-width': 3,
        'line-opacity': 1,
      },
    });

    map.on('click', ALERTS_FILL, (e) => {
      const f = e.features?.[0];
      const id = f?.properties?.id;
      if (typeof id === 'string') focusAlert(id);
    });
    map.on('mouseenter', ALERTS_FILL, () => {
      map.getCanvas().style.cursor = 'pointer';
    });
    map.on('mouseleave', ALERTS_FILL, () => {
      map.getCanvas().style.cursor = '';
    });
  }, [alerts, styleLoaded, focusAlert]);

  // Tornado pulse animation.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleLoaded) return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = ((now - start) % 1400) / 1400;
      const opacity = 0.55 + Math.abs(Math.sin(t * Math.PI)) * 0.45;
      if (map.getLayer(ALERTS_PULSE)) {
        map.setPaintProperty(ALERTS_PULSE, 'line-opacity', opacity);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [styleLoaded]);

  // Fly to + highlight a focused alert.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleLoaded) return;

    if (!focusedAlertId) {
      if (map.getLayer(ALERTS_FOCUS)) {
        map.setFilter(ALERTS_FOCUS, ['==', ['get', 'id'], '__none__']);
      }
      return;
    }
    const target = alerts.find((a) => a.id === focusedAlertId);
    if (!target?.geometry) return;

    if (map.getLayer(ALERTS_FOCUS)) {
      map.setFilter(ALERTS_FOCUS, ['==', ['get', 'id'], focusedAlertId]);
    }

    // Compute bounds from geometry (Polygon / MultiPolygon / Point).
    const bounds = new maplibregl.LngLatBounds();
    const collect = (g: GeoJSON.Geometry) => {
      if (g.type === 'Polygon') for (const ring of g.coordinates) for (const c of ring) bounds.extend([c[0], c[1]] as [number, number]);
      else if (g.type === 'MultiPolygon')
        for (const poly of g.coordinates)
          for (const ring of poly)
            for (const c of ring) bounds.extend([c[0], c[1]] as [number, number]);
      else if (g.type === 'Point')
        bounds.extend(g.coordinates as [number, number]);
    };
    collect(target.geometry);
    if (!bounds.isEmpty()) {
      map.fitBounds(bounds, { padding: 80, duration: 700, maxZoom: 9 });
    }
  }, [focusedAlertId, alerts, styleLoaded]);

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="absolute inset-0" />
    </div>
  );
}
