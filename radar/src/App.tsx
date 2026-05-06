import { useState } from 'react';
import maplibregl from 'maplibre-gl';
import { TopBar } from './components/layout/TopBar';
import { ProductRail } from './components/radar/ProductRail';
import { TimeScrubber } from './components/radar/TimeScrubber';
import { AlertsPanel } from './components/radar/AlertsPanel';
import { RadarMap } from './components/radar/RadarMap';
import { RadarLegend } from './components/radar/RadarLegend';
import { StationModal } from './components/radar/StationModal';
import { useIsMobile } from './hooks/useMediaQuery';
import { PRODUCTS } from './constants/products';
import { useRadarStore } from './store/useRadarStore';

export default function App() {
  const [map, setMap] = useState<maplibregl.Map | null>(null);
  const isMobile = useIsMobile();

  return (
    <div className="flex h-[100dvh] w-full flex-col">
      <TopBar map={map} />

      {isMobile ? <MobileProductStrip /> : null}

      <div className="relative flex flex-1 overflow-hidden">
        {!isMobile ? <ProductRail /> : null}

        <main className="relative flex-1 overflow-hidden">
          <RadarMap onMapReady={setMap} />
          <RadarLegend />
        </main>

        {!isMobile ? <AlertsPanel /> : null}
      </div>

      <TimeScrubber />

      {isMobile ? <AlertsPanel /> : null}

      <StationModal />
    </div>
  );
}

function MobileProductStrip() {
  const activeProduct = useRadarStore((s) => s.activeProduct);
  const setActiveProduct = useRadarStore((s) => s.setActiveProduct);
  const mapZoom = useRadarStore((s) => s.mapZoom);
  return (
    <div
      className="border-b border-[var(--line-subtle)] px-2 py-2"
      style={{ background: 'var(--glass)' }}
    >
      <div className="flex gap-1 overflow-x-auto">
        {PRODUCTS.map((p) => {
          const Icon = p.icon;
          const disabled =
            p.layer === 'placeholder' ||
            (p.requiresZoom !== undefined && mapZoom < p.requiresZoom);
          const active = activeProduct === p.id;
          return (
            <button
              key={p.id}
              type="button"
              disabled={disabled}
              onClick={() => !disabled && setActiveProduct(p.id)}
              aria-label={p.label}
              className={`flex shrink-0 flex-col items-center gap-0.5 rounded-md px-3 py-1.5 text-[10px] font-semibold tracking-wider ${
                disabled
                  ? 'text-[var(--ink-4)]'
                  : active
                    ? 'text-black'
                    : 'bg-white/5 text-[var(--ink-3)]'
              }`}
              style={
                active
                  ? {
                      background: 'var(--accent)',
                      boxShadow: '0 0 12px var(--accent-glow)',
                    }
                  : undefined
              }
            >
              <Icon className="h-4 w-4" strokeWidth={1.8} />
              {p.shortLabel}
            </button>
          );
        })}
      </div>
    </div>
  );
}
