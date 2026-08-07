import maplibregl from 'maplibre-gl';
import { useEffect, useRef, useState } from 'react';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { TropicalFeatureProps } from '../../lib/nhcTropical';

const STYLE_URL = 'https://tiles.openfreemap.org/styles/dark';
const SOURCE = 'nhc-tropical';
const FILL = 'nhc-tropical-fill';
const LINE = 'nhc-tropical-line';
const CIRCLE = 'nhc-tropical-circle';

interface Props {
  geojson: GeoJSON.FeatureCollection;
  center: { lon: number; lat: number; zoom: number };
  onFeatureClick?: (props: TropicalFeatureProps | null) => void;
}

export function TropicalMap({ geojson, center, onFeatureClick }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [styleLoaded, setStyleLoaded] = useState(false);
  const onClickRef = useRef(onFeatureClick);
  onClickRef.current = onFeatureClick;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE_URL,
      center: [center.lon, center.lat],
      zoom: center.zoom,
      attributionControl: { compact: true },
    });
    mapRef.current = map;

    map.on('load', () => {
      map.addSource(SOURCE, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      map.addLayer({
        id: FILL,
        type: 'fill',
        source: SOURCE,
        filter: [
          'any',
          ['==', ['geometry-type'], 'Polygon'],
          ['==', ['geometry-type'], 'MultiPolygon'],
        ],
        paint: {
          'fill-color': ['get', 'fill'],
          'fill-opacity': 0.4,
        },
      });
      map.addLayer({
        id: LINE,
        type: 'line',
        source: SOURCE,
        filter: [
          'any',
          ['==', ['geometry-type'], 'LineString'],
          ['==', ['geometry-type'], 'MultiLineString'],
          ['==', ['geometry-type'], 'Polygon'],
          ['==', ['geometry-type'], 'MultiPolygon'],
        ],
        paint: {
          'line-color': ['get', 'stroke'],
          'line-width': 2,
          'line-opacity': 0.9,
        },
      });
      map.addLayer({
        id: CIRCLE,
        type: 'circle',
        source: SOURCE,
        filter: ['==', ['geometry-type'], 'Point'],
        paint: {
          'circle-radius': 6,
          'circle-color': ['coalesce', ['get', 'fill'], '#fff'],
          'circle-stroke-width': 1.5,
          'circle-stroke-color': '#0a0e15',
        },
      });
      setStyleLoaded(true);
    });

    const onClick = (e: maplibregl.MapLayerMouseEvent) => {
      const f = e.features?.[0];
      if (!f?.properties) {
        onClickRef.current?.(null);
        return;
      }
      onClickRef.current?.(f.properties as unknown as TropicalFeatureProps);
    };

    map.on('click', FILL, onClick);
    map.on('click', LINE, onClick);
    map.on('click', CIRCLE, onClick);
    map.on('click', (e) => {
      const hits = map.queryRenderedFeatures(e.point, {
        layers: [FILL, LINE, CIRCLE],
      });
      if (hits.length === 0) onClickRef.current?.(null);
    });

    for (const layer of [FILL, LINE, CIRCLE]) {
      map.on('mouseenter', layer, () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', layer, () => {
        map.getCanvas().style.cursor = '';
      });
    }

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleLoaded) return;
    map.easeTo({
      center: [center.lon, center.lat],
      zoom: center.zoom,
      duration: 600,
    });
  }, [center.lon, center.lat, center.zoom, styleLoaded]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleLoaded) return;
    const src = map.getSource(SOURCE) as maplibregl.GeoJSONSource | undefined;
    src?.setData(geojson);
  }, [geojson, styleLoaded]);

  return <div ref={containerRef} className="absolute inset-0" />;
}
