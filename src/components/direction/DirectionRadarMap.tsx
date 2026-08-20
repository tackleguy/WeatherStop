// Lightweight MapLibre canvas for Direction Radar — origin, destination, route.

import maplibregl from 'maplibre-gl';
import { useEffect, useRef } from 'react';
import { useSettings } from '../../hooks/useSettings';
import { mapStyleUrl } from '../../lib/mapStyles';

const ROUTE_SOURCE = 'dir-route';
const POINTS_SOURCE = 'dir-points';

interface Props {
  origin: [number, number] | null;
  destination: [number, number] | null;
  routeGeometry: GeoJSON.LineString | null;
}

export function DirectionRadarMap({
  origin,
  destination,
  routeGeometry,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const { settings } = useSettings();

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: mapStyleUrl(settings.mapStyle),
      center: origin ?? destination ?? [-97.5, 35.5],
      zoom: origin || destination ? 7 : 4.2,
      attributionControl: { compact: true },
    });
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: false }), 'top-right');
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
    // Intentionally mount once; style swaps remount via key from parent if needed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const ensure = () => {
      if (!map.getSource(ROUTE_SOURCE)) {
        map.addSource(ROUTE_SOURCE, {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        });
        map.addLayer({
          id: 'dir-route-line',
          type: 'line',
          source: ROUTE_SOURCE,
          paint: {
            'line-color': '#22d3ee',
            'line-width': 4,
            'line-opacity': 0.9,
          },
        });
      }
      if (!map.getSource(POINTS_SOURCE)) {
        map.addSource(POINTS_SOURCE, {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        });
        map.addLayer({
          id: 'dir-points-circle',
          type: 'circle',
          source: POINTS_SOURCE,
          paint: {
            'circle-radius': [
              'match',
              ['get', 'role'],
              'origin',
              8,
              9,
            ],
            'circle-color': [
              'match',
              ['get', 'role'],
              'origin',
              '#34d399',
              '#f472b6',
            ],
            'circle-stroke-color': '#0b1220',
            'circle-stroke-width': 2,
          },
        });
        map.addLayer({
          id: 'dir-points-label',
          type: 'symbol',
          source: POINTS_SOURCE,
          layout: {
            'text-field': ['get', 'label'],
            'text-size': 11,
            'text-offset': [0, 1.2],
            'text-anchor': 'top',
            'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
          },
          paint: {
            'text-color': '#ecfeff',
            'text-halo-color': '#0b1220',
            'text-halo-width': 1.3,
          },
        });
      }

      const routeSrc = map.getSource(ROUTE_SOURCE) as maplibregl.GeoJSONSource;
      routeSrc.setData({
        type: 'FeatureCollection',
        features: routeGeometry
          ? [
              {
                type: 'Feature',
                properties: {},
                geometry: routeGeometry,
              },
            ]
          : [],
      });

      const features: GeoJSON.Feature[] = [];
      if (origin) {
        features.push({
          type: 'Feature',
          properties: { role: 'origin', label: 'You' },
          geometry: { type: 'Point', coordinates: origin },
        });
      }
      if (destination) {
        features.push({
          type: 'Feature',
          properties: { role: 'dest', label: 'Destination' },
          geometry: { type: 'Point', coordinates: destination },
        });
      }
      const pts = map.getSource(POINTS_SOURCE) as maplibregl.GeoJSONSource;
      pts.setData({ type: 'FeatureCollection', features });

      if (origin && destination) {
        const bounds = new maplibregl.LngLatBounds(origin, origin);
        bounds.extend(destination);
        if (routeGeometry?.coordinates?.length) {
          for (const c of routeGeometry.coordinates) {
            bounds.extend(c as [number, number]);
          }
        }
        map.fitBounds(bounds, { padding: 56, maxZoom: 10, duration: 600 });
      } else if (origin) {
        map.easeTo({ center: origin, zoom: Math.max(map.getZoom(), 8), duration: 500 });
      } else if (destination) {
        map.easeTo({
          center: destination,
          zoom: Math.max(map.getZoom(), 7.5),
          duration: 500,
        });
      }
    };

    if (map.isStyleLoaded()) ensure();
    else map.once('load', ensure);
  }, [origin, destination, routeGeometry]);

  return (
    <div
      ref={containerRef}
      className="h-full w-full overflow-hidden rounded-2xl border border-[var(--line-subtle)]"
    />
  );
}
