import maplibregl from 'maplibre-gl';
import { useEffect, useRef, useState } from 'react';
import { severityColor, type NWSAlert } from '../hooks/useAlerts';
import { useNexradLayer } from '../hooks/useNexradLayer';
import { useRadarStack } from '../hooks/useRadarStack';
import { useSatelliteLayer } from '../hooks/useSatelliteLayer';
import { useWindyLayer } from '../hooks/useWindyLayer';
import { RadarLegend } from './RadarLegend';

const STYLE_URL = 'https://tiles.openfreemap.org/styles/dark';
const ALERTS_SOURCE_ID = 'nws-alerts';
const ALERTS_FILL_LAYER = 'nws-alerts-fill';
const ALERTS_LINE_LAYER = 'nws-alerts-line';
const ALERTS_PULSE_LAYER = 'nws-alerts-pulse';

interface Props {
  alerts: NWSAlert[];
  /** Active timestamp in unix seconds (snapped to 5-min). */
  selectedTime: number;
  /** ProductId-driven mode picker. */
  layerMode: 'radar' | 'satellite';
  /** Satellite product when layerMode='satellite'. */
  satelliteProduct: 'ir' | 'vis';
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
  selectedTime,
  layerMode,
  satelliteProduct,
  onAlertClick,
  onMapReady,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [styleLoaded, setStyleLoaded] = useState(false);

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

  // Keep Windy ts as a 10-min-rounded epoch-second value driven by the
  // global selectedTime so scrubbing back loads historical Windy frames.
  const windyTs = Math.floor(selectedTime / 600) * 600;

  useWindyLayer({
    map: styleLoaded && layerMode === 'radar' ? mapRef.current : null,
    ts: windyTs,
    product: 'radar',
  });

  useNexradLayer({
    map: styleLoaded && layerMode === 'radar' ? mapRef.current : null,
    time: selectedTime * 1000,
  });

  useRadarStack(styleLoaded && layerMode === 'radar' ? mapRef.current : null);

  useSatelliteLayer({
    map: styleLoaded ? mapRef.current : null,
    enabled: layerMode === 'satellite',
    product: satelliteProduct,
  });

  // Alerts source + layers stay mounted across mode switches.
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
      paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.18 },
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

  // Tornado pulse animation.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleLoaded) return;
    let raf = 0;
    const start = performance.now();
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
      <RadarLegend />
    </div>
  );
}
