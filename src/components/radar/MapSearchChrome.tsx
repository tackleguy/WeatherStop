// Floating map search chrome. Brand lives in PillNav — this bar is
// search + alert/station actions only, overlaid on the map like Windy.

import { Activity, Bell, Menu, RotateCcw, Search, X } from 'lucide-react';
import type maplibregl from 'maplibre-gl';
import { useState } from 'react';
import { IconButton } from '../ui/IconButton';
import { SearchBar } from './SearchBar';
import { useRadarStore } from '../../store/useRadarStore';
import { useIsMobile } from '../../hooks/useMediaQuery';

interface Props {
  map: maplibregl.Map | null;
}

function flyToPick(
  map: maplibregl.Map | null,
  p: { lon: number; lat: number; bbox?: [number, number, number, number] },
) {
  if (!map) return;
  if (p.bbox) {
    map.fitBounds(
      [
        [p.bbox[0], p.bbox[1]],
        [p.bbox[2], p.bbox[3]],
      ],
      { padding: 80, duration: 700, maxZoom: 9 },
    );
  } else {
    map.flyTo({ center: [p.lon, p.lat], zoom: 9, duration: 700 });
  }
}

export function MapSearchChrome({ map }: Props) {
  const alertCount = useRadarStore((s) => s.alertCount);
  const togglePanel = useRadarStore((s) => s.togglePanel);
  const resetMapView = useRadarStore((s) => s.resetMapView);
  const isMobile = useIsMobile();
  const [mobileOpen, setMobileOpen] = useState(false);

  const reset = () => {
    resetMapView();
    if (map) {
      map.flyTo({ center: [-95, 39], zoom: 4, duration: 700 });
    }
  };

  if (isMobile) {
    return (
      <>
        <div className="pointer-events-auto absolute right-3 top-3 z-20 flex gap-2">
          <IconButton
            icon={mobileOpen ? X : Search}
            title={mobileOpen ? 'Close search' : 'Search location'}
            onClick={() => setMobileOpen((v) => !v)}
            className="h-9 w-9 border border-[var(--line-default)] backdrop-blur-md"
            style={{ background: 'var(--glass-hi)' }}
          />
          <button
            type="button"
            onClick={() => togglePanel('alerts')}
            className="relative grid h-9 w-9 place-items-center rounded-lg border border-[var(--line-default)] text-[var(--ink-2)] backdrop-blur-md transition-colors hover:bg-white/5 hover:text-[var(--ink-1)]"
            style={{ background: 'var(--glass-hi)' }}
            title={`${alertCount} active alerts`}
            aria-label={`${alertCount} active alerts`}
          >
            <Bell className="h-4 w-4" strokeWidth={1.6} />
            {alertCount > 0 ? (
              <span
                data-num
                className="absolute -right-0.5 -top-0.5 grid h-4 min-w-[16px] place-items-center rounded-full px-1 text-[10px] font-bold text-white"
                style={{ background: 'var(--sev-severe)' }}
              >
                {alertCount > 9 ? '9+' : alertCount}
              </span>
            ) : null}
          </button>
        </div>
        {mobileOpen ? (
          <div
            className="pointer-events-auto absolute left-3 right-3 top-14 z-30"
          >
            <SearchBar
              onPick={(p) => {
                flyToPick(map, p);
                setMobileOpen(false);
              }}
            />
          </div>
        ) : null}
      </>
    );
  }

  return (
    <div className="pointer-events-none absolute left-3 right-3 top-3 z-20 flex items-start gap-2">
      <div className="pointer-events-auto w-full max-w-sm">
        <SearchBar onPick={(p) => flyToPick(map, p)} />
      </div>
      <div className="pointer-events-auto ml-auto flex items-center gap-1.5">
        <IconButton
          icon={RotateCcw}
          title="Reset map layers"
          onClick={reset}
          className="h-9 w-9 border border-[var(--line-default)] backdrop-blur-md"
          style={{ background: 'var(--glass-hi)' }}
        />
        <IconButton
          icon={Activity}
          title="Diagnostics"
          onClick={() => togglePanel('diagnostics')}
          className="h-9 w-9 border border-[var(--line-default)] backdrop-blur-md"
          style={{ background: 'var(--glass-hi)' }}
        />
        <button
          type="button"
          onClick={() => togglePanel('alerts')}
          className="relative grid h-9 w-9 place-items-center rounded-lg border border-[var(--line-default)] text-[var(--ink-2)] backdrop-blur-md transition-colors hover:bg-white/5 hover:text-[var(--ink-1)]"
          style={{ background: 'var(--glass-hi)' }}
          title={`${alertCount} active alerts`}
          aria-label={`${alertCount} active alerts`}
        >
          <Bell className="h-4 w-4" strokeWidth={1.6} />
          {alertCount > 0 ? (
            <span
              data-num
              className="absolute -right-0.5 -top-0.5 grid h-4 min-w-[16px] place-items-center rounded-full px-1 text-[10px] font-bold text-white"
              style={{ background: 'var(--sev-severe)' }}
            >
              {alertCount > 9 ? '9+' : alertCount}
            </span>
          ) : null}
        </button>
        <IconButton
          icon={Menu}
          title="Stations"
          onClick={() => togglePanel('stations')}
          className="h-9 w-9 border border-[var(--line-default)] backdrop-blur-md"
          style={{ background: 'var(--glass-hi)' }}
        />
      </div>
    </div>
  );
}
