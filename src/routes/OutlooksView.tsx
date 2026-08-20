// SPC convective + fire weather outlooks — Day 1–8 products on MapLibre.

import { useState } from 'react';
import { OutlooksControls } from '../components/outlooks/OutlooksControls';
import { OutlooksLegend } from '../components/outlooks/OutlooksLegend';
import { OutlooksMap } from '../components/outlooks/OutlooksMap';
import { OutlookInspectCard } from '../components/outlooks/OutlookInspectCard';
import { useOutlooks } from '../hooks/useOutlooks';
import {
  legendKindFor,
  type OutlookDay,
  type OutlookDomain,
  type OutlookFeatureProps,
  type OutlookProduct,
} from '../lib/spcOutlooks';

export function OutlooksView() {
  const [domain, setDomain] = useState<OutlookDomain>('convective');
  const [day, setDay] = useState<OutlookDay>(1);
  const [product, setProduct] = useState<OutlookProduct>('cat');
  const [inspect, setInspect] = useState<OutlookFeatureProps | null>(null);
  const { geojson, loading, error } = useOutlooks(day, product);
  const legendKind = legendKindFor(domain, day, product);

  return (
    <div
      className="absolute inset-0 flex flex-col"
      style={{ background: 'var(--surface-0)' }}
    >
      <div className="h-3 shrink-0" aria-hidden />

      <div className="relative flex-1 overflow-hidden">
        <OutlooksMap geojson={geojson} onFeatureClick={setInspect} />

        <OutlooksControls
          domain={domain}
          day={day}
          product={product}
          onDomainChange={(d) => {
            setDomain(d);
            setInspect(null);
          }}
          onDayChange={(d) => {
            setDay(d);
            setInspect(null);
          }}
          onProductChange={(p) => {
            setProduct(p);
            setInspect(null);
          }}
          loading={loading}
        />

        <OutlooksLegend kind={legendKind} />
        <OutlookInspectCard feature={inspect} onClose={() => setInspect(null)} />

        {error ? (
          <div
            className="pointer-events-none absolute bottom-4 left-1/2 z-20 max-w-sm -translate-x-1/2 floating-subpanel px-4 py-2 text-center text-[12px] text-[var(--ink-2)]"
          >
            Couldn’t load SPC outlooks. Check your connection and try again.
          </div>
        ) : null}

        {!loading && !error && geojson.features.length === 0 ? (
          <div
            className="pointer-events-none absolute left-1/2 top-1/2 z-10 max-w-xs -translate-x-1/2 -translate-y-1/2 floating-panel px-4 py-3 text-center text-[13px] text-[var(--ink-3)]"
          >
            No outlook polygons for this day / product right now.
          </div>
        ) : null}
      </div>
    </div>
  );
}
