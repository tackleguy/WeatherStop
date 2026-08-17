import maplibregl from 'maplibre-gl';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useRadarLayers } from '../../hooks/useRadarLayers';
import { useAlerts } from '../../hooks/useAlerts';
import { useRainViewer } from '../../hooks/useRainViewer';
import { useTimeFrames } from '../../hooks/useTimeFrames';
import { useSettings } from '../../hooks/useSettings';
import { useTropical } from '../../hooks/useTropical';
import { mapStyleUrl } from '../../lib/mapStyles';
import { alertsPageHref } from '../../lib/alertsNav';
import {
  alertStorms,
  stormOverlayGeoJSON,
} from '../../lib/stormIntelligence';
import {
  categorizeAlertEvent,
  type AlertCategory,
  useRadarStore,
} from '../../store/useRadarStore';
const ALERTS_SOURCE = 'nws-alerts';
const ALERTS_FILL = 'nws-alerts-fill';
const ALERTS_LINE = 'nws-alerts-line';
const ALERTS_PULSE = 'nws-alerts-pulse';
const ALERTS_FOCUS = 'nws-alerts-focus';
const STORM_AREAS_SOURCE = 'storm-intel-areas';
const STORM_PATHS_SOURCE = 'storm-intel-paths';
const STORM_POINTS_SOURCE = 'storm-intel-points';
const STORM_AREAS_FILL = 'storm-intel-areas-fill';
const STORM_AREAS_LINE = 'storm-intel-areas-line';
const STORM_PATHS_LINE = 'storm-intel-paths-line';
const STORM_POINTS_LAYER = 'storm-intel-points-layer';
const NHC_TRACK_SOURCE = 'nhc-radar-track';
const NHC_POINTS_SOURCE = 'nhc-radar-points';
const NHC_TRACK_LAYER = 'nhc-radar-track-layer';
const NHC_POINTS_LAYER = 'nhc-radar-points-layer';
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
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [styleLoaded, setStyleLoaded] = useState(false);
  const { settings } = useSettings();
  const styleUrl = mapStyleUrl(settings.mapStyle);
  const styleUrlRef = useRef(styleUrl);

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
  // Iowa State historical frames need a YYYYMMDDHHMM path segment.
  // The live (latest) frame uses the unversioned cache, so pass null.
  const iowaTs = useMemo(() => {
    if (currentFrameIdx >= frames.length - 1) return null;
    const d = new Date(ts * 1000);
    return (
      `${d.getUTCFullYear()}` +
      `${String(d.getUTCMonth() + 1).padStart(2, '0')}` +
      `${String(d.getUTCDate()).padStart(2, '0')}` +
      `${String(d.getUTCHours()).padStart(2, '0')}` +
      `${String(d.getUTCMinutes()).padStart(2, '0')}`
    );
  }, [ts, currentFrameIdx, frames.length]);

  // OpenGeo WMS TIME — ISO8601; server snaps with nearestValue=1.
  // Live frame omits TIME so the service returns the latest scan.
  const wmsTime = useMemo(() => {
    if (currentFrameIdx >= frames.length - 1) return null;
    return new Date(ts * 1000).toISOString();
  }, [ts, currentFrameIdx, frames.length]);

  const { catalog } = useRainViewer();
  // Map our 0..FRAME_COUNT-1 scrubber index onto the actual RainViewer
  // catalog frame list so each notch on the slider lines up with a real
  // frame instead of an interpolated timestamp. We pick the frame whose
  // time is closest to the slider's selected timestamp.
  const rainViewerFrameIndex = useMemo(() => {
    if (!catalog) return 0;
    const list =
      activeProduct === 'satellite-ir' || activeProduct === 'satellite-vis'
        ? catalog.satelliteInfrared
        : [...catalog.radarPast, ...catalog.radarNowcast];
    if (list.length === 0) return 0;
    let bestIdx = list.length - 1;
    let bestDiff = Infinity;
    for (let i = 0; i < list.length; i++) {
      const d = Math.abs(list[i].time - ts);
      if (d < bestDiff) {
        bestDiff = d;
        bestIdx = i;
      }
    }
    return bestIdx;
  }, [catalog, activeProduct, ts]);

  const { alerts } = useAlerts();
  const { geojson: nhcTrack } = useTropical('track', 'all');
  const { geojson: nhcPoints } = useTropical('points', 'all');
  const stormOverlays = useMemo(
    () => stormOverlayGeoJSON(alertStorms(alerts)),
    [alerts],
  );

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
      style: styleUrlRef.current,
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
      // Handle for console debugging and scripts/verify-layers.mjs, which
      // asserts that each product's overlay actually paints pixels.
      if (import.meta.env.DEV) {
        (window as unknown as Record<string, unknown>).__wsMap = map;
      }
    });
    map.on('moveend', updateViewport);
    map.on('zoom', () => setMapZoom(map.getZoom()));

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Swap basemap without destroying the map. Overlay effects remount when
  // styleLoaded flips false → true after style.load.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || styleUrlRef.current === styleUrl) return;
    styleUrlRef.current = styleUrl;
    setStyleLoaded(false);
    map.setStyle(styleUrl);
    map.once('style.load', () => setStyleLoaded(true));
  }, [styleUrl]);

  const manualSite = useRadarStore((s) => s.manualSite);
  const sourcePlan = useRadarLayers({
    map: mapRef.current,
    styleLoaded,
    activeProduct,
    catalog,
    frameIndex: rainViewerFrameIndex,
    ts,
    iowaTs,
    wmsTime,
    manualSite,
  });

  // Push the active plan to the store so the layer-info chip can read
  // it without lifting state. Cheap setState — Zustand bails on equality.
  const setSourcePlan = useRadarStore((s) => s.setSourcePlan);
  useEffect(() => {
    setSourcePlan({
      kind: sourcePlan.kind,
      label: sourcePlan.label,
      attribution: sourcePlan.attribution,
      siteId: sourcePlan.site?.id ?? null,
      siteName: sourcePlan.site?.name ?? null,
      siteState: sourcePlan.site?.state ?? null,
      unavailableReason: sourcePlan.unavailableReason ?? null,
    });
  }, [sourcePlan, setSourcePlan]);

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

  // Click handling: alerts → alerts page; otherwise → ruler/inspect.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleLoaded) return;

    const handler = (e: maplibregl.MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] }) => {
      const hits = map.queryRenderedFeatures(e.point, {
        layers: [ALERTS_FILL],
      });
      if (hits.length > 0 && !rulerActive) {
        const id = hits[0].properties?.id;
        if (typeof id === 'string') {
          focusAlert(id);
          navigate(alertsPageHref(id));
          return;
        }
      }

      const lngLat: [number, number] = [e.lngLat.lng, e.lngLat.lat];

      if (rulerActive) {
        pushRulerPoint(lngLat);
        return;
      }

      setInspectAt(lngLat);
    };

    map.on('click', handler);
    return () => {
      map.off('click', handler);
    };
  }, [
    styleLoaded,
    rulerActive,
    focusAlert,
    pushRulerPoint,
    setInspectAt,
    navigate,
  ]);

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

  // Local storm-intelligence circles + one-hour motion paths, plus official
  // NHC hurricane forecast tracks. Tornado circles only come from NWS warnings.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleLoaded) return;

    const upsert = (id: string, data: GeoJSON.FeatureCollection) => {
      const source = map.getSource(id) as maplibregl.GeoJSONSource | undefined;
      if (source) source.setData(data);
      else map.addSource(id, { type: 'geojson', data });
    };

    upsert(STORM_AREAS_SOURCE, stormOverlays.areas);
    upsert(STORM_PATHS_SOURCE, stormOverlays.paths);
    upsert(STORM_POINTS_SOURCE, stormOverlays.points);
    upsert(NHC_TRACK_SOURCE, nhcTrack);
    upsert(NHC_POINTS_SOURCE, nhcPoints);

    const dangerColor: maplibregl.DataDrivenPropertyValueSpecification<string> = [
      'match',
      ['get', 'danger'],
      'extreme',
      '#f43f5e',
      'high',
      '#fb923c',
      'moderate',
      '#facc15',
      '#38bdf8',
    ];

    if (!map.getLayer(STORM_AREAS_FILL)) {
      map.addLayer({
        id: STORM_AREAS_FILL,
        type: 'fill',
        source: STORM_AREAS_SOURCE,
        paint: {
          'fill-color': dangerColor,
          'fill-opacity': 0.08,
        },
      });
    }
    if (!map.getLayer(STORM_AREAS_LINE)) {
      map.addLayer({
        id: STORM_AREAS_LINE,
        type: 'line',
        source: STORM_AREAS_SOURCE,
        paint: {
          'line-color': dangerColor,
          'line-width': 2.2,
          'line-opacity': 0.95,
        },
      });
    }
    if (!map.getLayer(STORM_PATHS_LINE)) {
      map.addLayer({
        id: STORM_PATHS_LINE,
        type: 'line',
        source: STORM_PATHS_SOURCE,
        paint: {
          'line-color': dangerColor,
          'line-width': 2.5,
          'line-dasharray': [2, 1.5],
          'line-opacity': 0.95,
        },
      });
    }
    if (!map.getLayer(STORM_POINTS_LAYER)) {
      map.addLayer({
        id: STORM_POINTS_LAYER,
        type: 'circle',
        source: STORM_POINTS_SOURCE,
        paint: {
          'circle-radius': 5,
          'circle-color': dangerColor,
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 1.5,
        },
      });
    }
    if (!map.getLayer(NHC_TRACK_LAYER)) {
      map.addLayer({
        id: NHC_TRACK_LAYER,
        type: 'line',
        source: NHC_TRACK_SOURCE,
        paint: {
          'line-color': '#67e8f9',
          'line-width': 3,
          'line-dasharray': [1.5, 1],
          'line-opacity': 0.95,
        },
      });
    }
    if (!map.getLayer(NHC_POINTS_LAYER)) {
      map.addLayer({
        id: NHC_POINTS_LAYER,
        type: 'circle',
        source: NHC_POINTS_SOURCE,
        paint: {
          'circle-radius': 6,
          'circle-color': '#06b6d4',
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 1.5,
        },
      });
    }
  }, [styleLoaded, stormOverlays, nhcTrack, nhcPoints]);

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
