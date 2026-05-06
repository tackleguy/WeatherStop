import { Bell, Menu, Settings, Zap } from 'lucide-react';
import type maplibregl from 'maplibre-gl';
import { IconButton } from '../ui/IconButton';
import { SearchBar } from '../radar/SearchBar';
import { useRadarStore } from '../../store/useRadarStore';

interface Props {
  map: maplibregl.Map | null;
}

export function TopBar({ map }: Props) {
  const alertCount = useRadarStore((s) => s.alertCount);
  const togglePanel = useRadarStore((s) => s.togglePanel);

  return (
    <header
      className="relative z-20 flex h-11 shrink-0 items-center gap-4 border-b border-[var(--line-subtle)] px-4 backdrop-blur-[28px]"
      style={{ background: 'var(--glass)' }}
    >
      <div className="flex shrink-0 items-center gap-2">
        <Zap
          className="h-5 w-5"
          style={{
            color: 'var(--accent)',
            filter: 'drop-shadow(0 0 6px var(--accent-glow))',
          }}
          strokeWidth={2.2}
        />
        <h1 className="text-[15px] font-semibold tracking-tight">
          WeatherStop{' '}
          <span style={{ color: 'var(--accent)' }}>Radar</span>
        </h1>
      </div>

      <div className="mx-auto max-w-md flex-1">
        <SearchBar
          onPick={(p) => {
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
          }}
        />
      </div>

      <button
        type="button"
        onClick={() => togglePanel('alerts')}
        className="relative rounded-lg p-2 text-[var(--ink-2)] transition-colors duration-[var(--t-fast)] hover:bg-white/5 hover:text-[var(--ink-1)]"
        title={`${alertCount} active alerts`}
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
        icon={Settings}
        title="Settings"
        onClick={() => togglePanel('settings')}
      />
      <IconButton icon={Menu} title="Stations" onClick={() => togglePanel('stations')} />
    </header>
  );
}
