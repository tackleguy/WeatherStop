import maplibregl from 'maplibre-gl';
import { useEffect, useMemo, useRef, useState } from 'react';
import { severityColor, type NWSAlert } from '../hooks/useAlerts';
import { useRadarLayers } from '../hooks/useRadarLayers';
import {
  pickRadarSource,
  type SourcePlan,
  type StormCell,
} from '../lib/sourceResolver';

const STYLE_URL = 'https://tiles.openfreemap.org/styles/dark';
const ALERTS_SOURCE_ID = 'nws-alerts';
const ALERTS_FILL_LAYER = 'nws-alerts-fill';
const ALERTS_LINE_LAYER = 'nws-alerts-line';
const ALERTS_PULSE_LAYER = 'nws-alerts-pulse';

interface Props {
  alerts: NWSAlert[];
  selectedProduct: string;
  selectedTime: number;
  focusedStorm: StormCell | null;
  onAlertClick: (alert: NWSAlert) => void;
  onMapReady?: (map: maplibregl.Map) => void;
}

function isTornadoEvent(event: string): boolean {
  return /tornado/i.test(event);
}

function alertsToFeatureCollection(
  alerts: NWSAlert[],
): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: alerts
      .filter((a) => a.geometry !== null)
      .map((a) => ({
        type: 'Feature',
        id: a.id,
        properties: {
          id: a.id,
          event: a.event,
          severity: a.severity,
          color: severityColor(a.severity),
          isTornado: isTornadoEvent(a.event),
        },
        geometry: a.geometry as GeoJSON.Geometry,
      })),
  };
}

export function RadarMap({
  alerts,
  selectedProduct,
  selectedTime,
  focusedStorm,
  onAlertClick,
  onMapReady,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [styleLoaded, setStyleLoaded] = useState(false);

  const [zoom, setZoom] = useState(4.2);
  const [center, setCenter] = useState<{ lng: number; lat: number }>({
    lng: -97,
    lat: 38,
  });

  // Set up the map once.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE_URL,
      center: [-97, 38],
      zoom: 4.2,
      minZoom: 3,
      maxZoom: 14,
      attributionControl: { compact: true },
    });
    mapRef.current = map;

    map.on('load', () => {
      setStyleLoaded(true);
      onMapReady?.(map);
    });
    map.on('moveend', () => {
      const c = map.getCenter();
      setCenter({ lng: c.lng, lat: c.lat });
      setZoom(map.getZoom());
    });

    map.addControl(
      new maplibregl.NavigationControl({ visualizePitch: false }),
      'top-right',
    );

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Resolve which radar source to render given the current state.
  const plan: SourcePlan = useMemo(
    () =>
      pickRadarSource({
        zoom,
        centerLon: center.lng,
        centerLat: center.lat,
        focusedStorm,
        selectedProduct,
      }),
    [zoom, center, focusedStorm, selectedProduct],
  );

  useRadarLayers({
    map: styleLoaded ? mapRef.current : null,
    plan,
    selectedTime,
  });

  // Maintain alerts source + layers.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleLoaded) return;
    const collection = alertsToFeatureCollection(alerts);
    const existing = map.getSource(ALERTS_SOURCE_ID) as
      | maplibregl.GeoJSONSource
      | undefined;
    if (existing) {
      existing.setData(collection);
      return;
    }
    map.addSource(ALERTS_SOURCE_ID, { type: 'geojson', data: collection });

    map.addLayer({
      id: ALERTS_FILL_LAYER,
      type: 'fill',
      source: ALERTS_SOURCE_ID,
      paint: {
        'fill-color': ['get', 'color'],
        'fill-opacity': 0.18,
      },
    });
    map.addLayer({
      id: ALERTS_LINE_LAYER,
      type: 'line',
      source: ALERTS_SOURCE_ID,
      paint: {
        'line-color': ['get', 'color'],
        'line-width': 1.6,
        'line-opacity': 0.95,
      },
    });
    // Pulsing red outline only on tornado events.
    map.addLayer({
      id: ALERTS_PULSE_LAYER,
      type: 'line',
      source: ALERTS_SOURCE_ID,
      filter: ['==', ['get', 'isTornado'], true],
      paint: {
        'line-color': '#ef4444',
        'line-width': 3,
        'line-blur': 1,
        'line-opacity': 0.85,
      },
    });

    map.on('click', ALERTS_FILL_LAYER, (e) => {
      const f = e.features?.[0];
      if (!f) return;
      const id = f.properties?.id;
      const alert = alerts.find((a) => a.id === id);
      if (alert) onAlertClick(alert);
    });
    map.on('mouseenter', ALERTS_FILL_LAYER, () => {
      map.getCanvas().style.cursor = 'pointer';
    });
    map.on('mouseleave', ALERTS_FILL_LAYER, () => {
      map.getCanvas().style.cursor = '';
    });
  }, [styleLoaded, alerts, onAlertClick]);

  // Tornado pulse via animated paint properties (CSS isn't reachable here).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleLoaded) return;
    let raf = 0;
    let start = performance.now();
    const tick = (now: number) => {
      const t = ((now - start) % 1400) / 1400;
      const opacity = 0.55 + Math.abs(Math.sin(t * Math.PI)) * 0.45;
      if (map.getLayer(ALERTS_PULSE_LAYER)) {
        map.setPaintProperty(ALERTS_PULSE_LAYER, 'line-opacity', opacity);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [styleLoaded]);

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="absolute inset-0" />
      {plan.source === 'WINDY' ? (
        <div className="absolute bottom-3 right-3 z-10 rounded-full bg-black/55 px-2 py-1 text-[10px] font-medium text-white/80 backdrop-blur">
          Radar by Windy.com
        </div>
      ) : (
        <div className="absolute bottom-3 right-3 z-10 rounded-full bg-black/55 px-2 py-1 text-[10px] font-medium text-white/80 backdrop-blur">
          {plan.source} · {plan.site.id} · {plan.site.name}
        </div>
      )}
    </div>
  );
}
