import maplibregl from 'maplibre-gl';
import { useEffect, useRef, useState } from 'react';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { OutlookFeatureProps } from '../../lib/spcOutlooks';

const STYLE_URL = 'https://tiles.openfreemap.org/styles/dark';
const SOURCE = 'spc-outlooks';
const FILL = 'spc-outlooks-fill';
const LINE = 'spc-outlooks-line';

interface Props {
  geojson: GeoJSON.FeatureCollection;
  onFeatureClick?: (props: OutlookFeatureProps | null) => void;
  onMapReady?: (map: maplibregl.Map) => void;
}

export function OutlooksMap({ geojson, onFeatureClick, onMapReady }: Props) {
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
      center: [-98.5, 39.5],
      zoom: 3.6,
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
        paint: {
          'fill-color': ['get', 'fill'],
          'fill-opacity': 0.45,
        },
      });
      map.addLayer({
        id: LINE,
        type: 'line',
        source: SOURCE,
        paint: {
          'line-color': ['get', 'stroke'],
          'line-width': 1.5,
          'line-opacity': 0.9,
        },
      });
      setStyleLoaded(true);
      onMapReady?.(map);
    });

    map.on('click', FILL, (e) => {
      const f = e.features?.[0];
      if (!f?.properties) {
        onClickRef.current?.(null);
        return;
      }
      onClickRef.current?.(f.properties as unknown as OutlookFeatureProps);
    });

    map.on('click', (e) => {
      const hits = map.queryRenderedFeatures(e.point, { layers: [FILL] });
      if (hits.length === 0) onClickRef.current?.(null);
    });

    map.on('mouseenter', FILL, () => {
      map.getCanvas().style.cursor = 'pointer';
    });
    map.on('mouseleave', FILL, () => {
      map.getCanvas().style.cursor = '';
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleLoaded) return;
    const src = map.getSource(SOURCE) as maplibregl.GeoJSONSource | undefined;
    src?.setData(geojson);
  }, [geojson, styleLoaded]);

  return <div ref={containerRef} className="absolute inset-0" />;
}
