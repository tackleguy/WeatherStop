// Map view (unified Radar / Composite / Satellite shell). The pill nav
// and global chrome live in App.tsx; this route lays out the map + rail
// + scrubber + floating search/widgets.

import maplibregl from 'maplibre-gl';
import { useState } from 'react';
import { AlertFilterChips } from '../components/radar/AlertFilterChips';
import { AiStormPanel } from '../components/radar/AiStormPanel';
import { AlertsPanel } from '../components/radar/AlertsPanel';
import { BookmarkBar } from '../components/radar/BookmarkBar';
import { ClickInspector } from '../components/radar/ClickInspector';
import { DiagnosticsPanel } from '../components/radar/DiagnosticsPanel';
import { DistanceRuler } from '../components/radar/DistanceRuler';
import { FocusedAlertChip } from '../components/radar/FocusedAlertChip';
import { LayerInfoCard } from '../components/radar/LayerInfoCard';
import { LayerLoadingChip } from '../components/radar/LayerLoadingChip';
import { LayerOpacitySlider } from '../components/radar/LayerOpacitySlider';
import { MapSearchChrome } from '../components/radar/MapSearchChrome';
import { NullschoolEarth } from '../components/radar/NullschoolEarth';
import { ProductRail } from '../components/radar/ProductRail';
import { RadarLegend } from '../components/radar/RadarLegend';
import { RadarMap } from '../components/radar/RadarMap';
import { ScaleBar } from '../components/radar/ScaleBar';
import { StationModal } from '../components/radar/StationModal';
import { SupercellCompanionChip } from '../components/radar/SupercellCompanionChip';
import { TimeScrubber } from '../components/radar/TimeScrubber';
import { useIsMobile } from '../hooks/useMediaQuery';
import { PRODUCTS } from '../constants/products';
import { useRadarStore } from '../store/useRadarStore';

export function RadarView() {
  const [map, setMap] = useState<maplibregl.Map | null>(null);
  const isMobile = useIsMobile();
  // AlertsPanel is absolutely positioned over the right edge of the map
  // rather than taking layout space, so the right-hand stack has to step
  // aside or the legend and ruler end up hidden behind it.
  const alertsOpen = useRadarStore((s) => s.panelsOpen.alerts);
  const alertsOverlap = !isMobile && alertsOpen;

  return (
    <div className="absolute inset-0 flex flex-col" style={{ background: 'var(--surface-0)' }}>
      {isMobile ? <MobileProductStrip /> : null}

      <div className="relative flex flex-1 overflow-hidden">
        {!isMobile ? (
          <div className="ml-2 mt-2">
            <ProductRail />
          </div>
        ) : null}

        <main className="relative flex-1 overflow-hidden">
          <RadarMap onMapReady={setMap} />
          <NullschoolEarth />

          <MapSearchChrome map={map} />

          {!isMobile ? <AlertFilterChips /> : null}
          {!isMobile ? <LayerOpacitySlider /> : null}
          <FocusedAlertChip />

          {/* Bottom corners are flex stacks rather than four independently
              positioned cards. Previously the bookmarks pill, the layer
              chip, the legend and the ruler all sat at bottom-[88px] with
              the same z-index, so whichever rendered last hid the status
              and "unavailable" messages underneath it. */}
          <div className="pointer-events-none absolute bottom-3 left-3 z-10 flex flex-col items-start gap-2">
            <DiagnosticsPanel />
            <BookmarkBar map={map} />
            <LayerLoadingChip />
            <LayerInfoCard
              onFlyToSite={(lon, lat) => {
                map?.flyTo({
                  center: [lon, lat],
                  zoom: Math.max(map.getZoom(), 7.5),
                  duration: 650,
                });
              }}
            />
            <ScaleBar map={map} />
            <SupercellCompanionChip />
          </div>

          <div
            className={`pointer-events-none absolute bottom-7 z-10 flex flex-col items-end gap-2 ${
              alertsOverlap ? 'right-[376px]' : 'right-4'
            }`}
          >
            <AiStormPanel />
            <DistanceRuler />
            <RadarLegend />
          </div>

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
      <div className="flex gap-1 overflow-x-auto no-scrollbar">
        {PRODUCTS.map((p) => {
          const Icon = p.icon;
          const disabled =
            p.requiresZoom !== undefined && mapZoom < p.requiresZoom;
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
