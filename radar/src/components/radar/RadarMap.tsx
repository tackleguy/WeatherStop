import maplibregl from 'maplibre-gl';
import { useEffect, useMemo, useRef, useState } from 'react';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useRadarLayers } from '../../hooks/useRadarLayers';
import { useAlerts } from '../../hooks/useAlerts';
import { useTimeFrames } from '../../hooks/useTimeFrames';
import {
  categorizeAlertEvent,
  type AlertCategory,
  useRadarStore,
} from '../../store/useRadarStore';

const STYLE_URL = 'https://tiles.openfreemap.org/styles/dark';
const ALERTS_SOURCE = 'nws-alerts';
const ALERTS_FILL = 'nws-alerts-fill';
const ALERTS_LINE = 'nws-alerts-line';
const ALERTS_PULSE = 'nws-alerts-pulse';
const ALERTS_FOCUS = 'nws-alerts-focus';
const RULER_SOURCE = 'ruler-line';
const RULER_LINE_LAYER = 'ruler-line-layer';
const RULER_POINTS_LAYER = 'ruler-points-layer';

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

function buildCategoryFilter(
  filter: Set<AlertCategory>,
): maplibregl.FilterSpecification | undefined {
  if (filter.size === 0) return undefined;
  const allowed: maplibregl.FilterSpecification = [
    'in',
    ['get', 'category'],
    ['literal', Array.from(filter)],
  ] as maplibregl.FilterSpecification;
  return allowed;
}

export function RadarMap({ onMapReady }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [styleLoaded, setStyleLoaded] = useState(false);

  const activeProduct = useRadarStore((s) => s.activeProduct);
  const currentFrameIdx = useRadarStore((s) => s.currentFrameIdx);
  const setMapZoom = useRadarStore((s) => s.setMapZoom);
  const setBbox = useRadarStore((s) => s.setBbox);
  const setMapCenter = useRadarStore((s) => s.setMapCenter);
  const focusedAlertId = useRadarStore((s) => s.focusedAlertId);
  const focusAlert = useRadarStore((s) => s.focusAlert);
  const alertFilter = useRadarStore((s) => s.alertFilter);
  const setInspectAt = useRadarStore((s) => s.setInspectAt);
  const rulerActive = useRadarStore((s) => s.rulerActive);
  const rulerPoints = useRadarStore((s) => s.rulerPoints);
  const pushRulerPoint = useRadarStore((s) => s.pushRulerPoint);

  const frames = useTimeFrames();
  const ts = frames[currentFrameIdx] ?? frames[frames.length - 1];

  const { alerts } = useAlerts();

  const features = useMemo<GeoJSON.Feature[]>(
    () =>
      alerts
        .filter((a) => a.geometry !== null)
        .map((a) => ({
          type: 'Feature',
          id: a.id,
          properties: {
            id: a.id,
            event: a.event,
            severity: a.severity,
            category: categorizeAlertEvent(a.event),
            isTornado: /tornado/i.test(a.event),
          },
          geometry: a.geometry as GeoJSON.Geometry,
        })),
    [alerts],
  );

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
    map.addControl(
      new maplibregl.NavigationControl({ showCompass: false }),
      'top-right',
    );

    const updateViewport = () => {
      const b = map.getBounds();
      const c = map.getCenter();
      setMapZoom(map.getZoom());
      setBbox([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]);
      setMapCenter([c.lng, c.lat]);
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

    map.on('mouseenter', ALERTS_FILL, () => {
      map.getCanvas().style.cursor = 'pointer';
    });
    map.on('mouseleave', ALERTS_FILL, () => {
      map.getCanvas().style.cursor = '';
    });
  }, [features, styleLoaded]);

  // Apply category filter to all alert layers as the user toggles it.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleLoaded) return;
    const catFilter = buildCategoryFilter(alertFilter);
    if (map.getLayer(ALERTS_FILL)) {
      map.setFilter(ALERTS_FILL, catFilter ?? null);
    }
    if (map.getLayer(ALERTS_LINE)) {
      map.setFilter(ALERTS_LINE, catFilter ?? null);
    }
  }, [alertFilter, styleLoaded]);

  // Click handling: alerts → focus; otherwise → ruler/inspect.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleLoaded) return;

    const handler = (e: maplibregl.MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] }) => {
      // If the click landed on an alert polygon, treat it as alert focus
      // (highest-priority interaction).
      const hits = map.queryRenderedFeatures(e.point, {
        layers: [ALERTS_FILL],
      });
      if (hits.length > 0 && !rulerActive) {
        const id = hits[0].properties?.id;
        if (typeof id === 'string') {
          focusAlert(id);
          return;
        }
      }

      const lngLat: [number, number] = [e.lngLat.lng, e.lngLat.lat];

      if (rulerActive) {
        pushRulerPoint(lngLat);
        return;
      }

      // Otherwise — show inspector for the clicked point.
      setInspectAt(lngLat);
    };

    map.on('click', handler);
    return () => {
      map.off('click', handler);
    };
  }, [styleLoaded, rulerActive, focusAlert, pushRulerPoint, setInspectAt]);

  // Cursor hint when the ruler tool is active.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.getCanvas().style.cursor = rulerActive ? 'crosshair' : '';
  }, [rulerActive]);

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

  // Ruler source + line layer.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleLoaded) return;

    const collection: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features:
        rulerPoints.length === 0
          ? []
          : [
              ...(rulerPoints.length === 2
                ? [
                    {
                      type: 'Feature',
                      properties: { kind: 'line' },
                      geometry: {
                        type: 'LineString',
                        coordinates: rulerPoints,
                      },
                    } as GeoJSON.Feature,
                  ]
                : []),
              ...rulerPoints.map<GeoJSON.Feature>((p, i) => ({
                type: 'Feature',
                properties: { kind: 'point', i },
                geometry: { type: 'Point', coordinates: p },
              })),
            ],
    };

    const existing = map.getSource(RULER_SOURCE) as
      | maplibregl.GeoJSONSource
      | undefined;
    if (existing) {
      existing.setData(collection);
      return;
    }
    map.addSource(RULER_SOURCE, { type: 'geojson', data: collection });
    map.addLayer({
      id: RULER_LINE_LAYER,
      type: 'line',
      source: RULER_SOURCE,
      filter: ['==', ['get', 'kind'], 'line'],
      paint: {
        'line-color': '#ff8a3d',
        'line-width': 2,
        'line-dasharray': [2, 2],
      },
    });
    map.addLayer({
      id: RULER_POINTS_LAYER,
      type: 'circle',
      source: RULER_SOURCE,
      filter: ['==', ['get', 'kind'], 'point'],
      paint: {
        'circle-radius': 5,
        'circle-color': '#ff8a3d',
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 2,
      },
    });
  }, [rulerPoints, styleLoaded]);

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
