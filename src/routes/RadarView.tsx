// Radar view. The pill nav and global chrome live in App.tsx; this
// route just lays out the map + rail + scrubber + floating widgets.

import maplibregl from 'maplibre-gl';
import { useState } from 'react';
import { AlertFilterChips } from '../components/radar/AlertFilterChips';
import { AlertsPanel } from '../components/radar/AlertsPanel';
import { BookmarkBar } from '../components/radar/BookmarkBar';
import { ClickInspector } from '../components/radar/ClickInspector';
import { DistanceRuler } from '../components/radar/DistanceRuler';
import { FocusedAlertChip } from '../components/radar/FocusedAlertChip';
import { LayerInfoCard } from '../components/radar/LayerInfoCard';
import { LayerOpacitySlider } from '../components/radar/LayerOpacitySlider';
import { ProductRail } from '../components/radar/ProductRail';
import { RadarLegend } from '../components/radar/RadarLegend';
import { RadarMap } from '../components/radar/RadarMap';
import { ScaleBar } from '../components/radar/ScaleBar';
import { StationModal } from '../components/radar/StationModal';
import { TimeScrubber } from '../components/radar/TimeScrubber';
import { useIsMobile } from '../hooks/useMediaQuery';
import { PRODUCTS } from '../constants/products';
import { useRadarStore } from '../store/useRadarStore';

export function RadarView() {
  const [map, setMap] = useState<maplibregl.Map | null>(null);
  const isMobile = useIsMobile();

  return (
    <div className="absolute inset-0 flex flex-col" style={{ background: 'var(--surface-0)' }}>
      {/* Top spacer for the floating pill nav */}
      <div className="h-20 shrink-0 sm:h-24" aria-hidden />

      {isMobile ? <MobileProductStrip /> : null}

      <div className="relative flex flex-1 overflow-hidden">
        {!isMobile ? (
          <div className="ml-2 mt-2">
            <ProductRail />
          </div>
        ) : null}

        <main className="relative flex-1 overflow-hidden">
          <RadarMap onMapReady={setMap} />

          {!isMobile ? <AlertFilterChips /> : null}
          {!isMobile ? <LayerOpacitySlider /> : null}
          <FocusedAlertChip />
          <RadarLegend />
          <LayerInfoCard />
          <ScaleBar map={map} />
          <BookmarkBar map={map} />
          <DistanceRuler />
          <ClickInspector />
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
