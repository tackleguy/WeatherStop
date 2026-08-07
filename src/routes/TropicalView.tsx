// NHC tropical — in-map cone / track / watches / GTWO via free MapServer GeoJSON.

import { useMemo, useState } from 'react';
import { TropicalControls } from '../components/tropical/TropicalControls';
import { TropicalInspectCard } from '../components/tropical/TropicalInspectCard';
import { TropicalLegend } from '../components/tropical/TropicalLegend';
import { TropicalMap } from '../components/tropical/TropicalMap';
import { useTropical } from '../hooks/useTropical';
import {
  BASIN_CENTERS,
  type TropicalBasin,
  type TropicalFeatureProps,
  type TropicalProduct,
} from '../lib/nhcTropical';

export function TropicalView() {
  const [basin, setBasin] = useState<TropicalBasin>('atl');
  const [product, setProduct] = useState<TropicalProduct>('cone');
  const [inspect, setInspect] = useState<TropicalFeatureProps | null>(null);
  const { geojson, loading, error } = useTropical(product, basin);

  const center = useMemo(() => {
    if (basin === 'all') return { lon: -80, lat: 20, zoom: 3.2 };
    return BASIN_CENTERS[basin];
  }, [basin]);

  return (
    <div
      className="absolute inset-0 flex flex-col"
      style={{ background: 'var(--surface-0)' }}
    >
      <div className="h-3 shrink-0" aria-hidden />

      <div className="relative flex-1 overflow-hidden">
        <TropicalMap
          geojson={geojson}
          center={center}
          onFeatureClick={setInspect}
        />

        <TropicalControls
          basin={basin}
          product={product}
          onBasinChange={(b) => {
            setBasin(b);
            setInspect(null);
          }}
          onProductChange={(p) => {
            setProduct(p);
            setInspect(null);
          }}
          loading={loading}
        />

        <TropicalLegend product={product} />
        <TropicalInspectCard
          feature={inspect}
          onClose={() => setInspect(null)}
        />

        {error ? (
          <div
            className="pointer-events-none absolute bottom-4 left-1/2 z-20 max-w-sm -translate-x-1/2 rounded-xl border border-[var(--line-default)] px-4 py-2 text-center text-[12px] text-[var(--ink-2)] backdrop-blur-[28px]"
            style={{ background: 'var(--glass-hi)' }}
          >
            Couldn’t load NHC products. Check your connection and try again.
          </div>
        ) : null}

        {!loading && !error && geojson.features.length === 0 ? (
          <div
            className="pointer-events-none absolute left-1/2 top-1/2 z-10 max-w-xs -translate-x-1/2 -translate-y-1/2 rounded-xl border border-[var(--line-default)] px-4 py-3 text-center text-[13px] text-[var(--ink-3)] backdrop-blur-[28px]"
            style={{ background: 'var(--glass-hi)' }}
          >
            No active tropical features for this basin / product right now.
          </div>
        ) : null}
      </div>
    </div>
  );
}
