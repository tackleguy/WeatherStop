// Floating map search chrome. Desktop bar is draggable; position persists.

import { Activity, Bell, GripVertical, Menu, RotateCcw, Search, X } from 'lucide-react';
import type maplibregl from 'maplibre-gl';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { IconButton } from '../ui/IconButton';
import { SearchBar } from './SearchBar';
import { BasemapControl } from './BasemapControl';
import { useRadarStore } from '../../store/useRadarStore';
import { useIsMobile } from '../../hooks/useMediaQuery';

interface Props {
  map: maplibregl.Map | null;
}

const POS_KEY = 'ws-search-pos-v1';

interface Pos {
  x: number;
  y: number;
}

function loadPos(): Pos | null {
  try {
    const raw = localStorage.getItem(POS_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Pos;
    if (typeof p.x === 'number' && typeof p.y === 'number') return p;
  } catch {
    // ignore
  }
  return null;
}

function savePos(p: Pos): void {
  try {
    localStorage.setItem(POS_KEY, JSON.stringify(p));
  } catch {
    // ignore
  }
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
  const [pos, setPos] = useState<Pos | null>(() => loadPos());
  const dragRef = useRef<{
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);
  const barRef = useRef<HTMLDivElement | null>(null);

  const clamp = useCallback((x: number, y: number): Pos => {
    const pad = 8;
    const w = barRef.current?.offsetWidth ?? 360;
    const h = barRef.current?.offsetHeight ?? 44;
    const maxX = Math.max(pad, window.innerWidth - w - pad);
    const maxY = Math.max(pad, window.innerHeight - h - 96);
    return {
      x: Math.min(maxX, Math.max(pad, x)),
      y: Math.min(maxY, Math.max(pad, y)),
    };
  }, []);

  useEffect(() => {
    if (!pos) return;
    setPos((p) => (p ? clamp(p.x, p.y) : p));
    const onResize = () => setPos((p) => (p ? clamp(p.x, p.y) : p));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [clamp]); // eslint-disable-line react-hooks/exhaustive-deps

  const onDragStart = (e: ReactPointerEvent) => {
    if (e.button !== 0) return;
    const el = barRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const current = pos ?? { x: rect.left, y: rect.top };
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: current.x,
      origY: current.y,
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onDragMove = (e: ReactPointerEvent) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    const next = clamp(
      dragRef.current.origX + dx,
      dragRef.current.origY + dy,
    );
    setPos(next);
  };

  const onDragEnd = () => {
    if (!dragRef.current || !pos) {
      dragRef.current = null;
      return;
    }
    savePos(pos);
    dragRef.current = null;
  };

  const reset = () => {
    resetMapView();
    if (map) {
      map.flyTo({ center: [-95, 39], zoom: 4, duration: 700 });
    }
  };

  const actions = (
    <div className="pointer-events-auto flex items-center gap-1.5">
      <BasemapControl />
      <IconButton
        icon={RotateCcw}
        title="Reset map layers"
        onClick={reset}
        className="h-9 w-9 border border-[var(--line-default)] backdrop-blur-md transition-colors"
        style={{ background: 'var(--glass-hi)' }}
      />
      <IconButton
        icon={Activity}
        title="Diagnostics"
        onClick={() => togglePanel('diagnostics')}
        className="h-9 w-9 border border-[var(--line-default)] backdrop-blur-md transition-colors"
        style={{ background: 'var(--glass-hi)' }}
      />
      <button
        type="button"
        onClick={() => togglePanel('alerts')}
        className="relative grid h-9 w-9 place-items-center rounded-lg border border-[var(--line-default)] text-[var(--ink-2)] backdrop-blur-md transition-colors hover:bg-[var(--hover-fill)] hover:text-[var(--ink-1)]"
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
        className="h-9 w-9 border border-[var(--line-default)] backdrop-blur-md transition-colors"
        style={{ background: 'var(--glass-hi)' }}
      />
    </div>
  );

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
          <BasemapControl />
          <button
            type="button"
            onClick={() => togglePanel('alerts')}
            className="relative grid h-9 w-9 place-items-center rounded-lg border border-[var(--line-default)] text-[var(--ink-2)] backdrop-blur-md transition-colors hover:bg-[var(--hover-fill)] hover:text-[var(--ink-1)]"
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
          <div className="pointer-events-auto absolute left-3 right-3 top-14 z-30 animate-[fadeSlide_var(--t-base)_var(--ease)]">
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

  const style: CSSProperties = pos
    ? { left: pos.x, top: pos.y, right: 'auto' }
    : { left: 12, top: 12, right: 12 };

  return (
    <>
      <div
        ref={barRef}
        className="pointer-events-none absolute z-20 flex items-start gap-2 transition-[box-shadow] duration-[var(--t-fast)]"
        style={style}
      >
        <div className="pointer-events-auto flex w-full max-w-sm items-stretch gap-0.5">
          <button
            type="button"
            aria-label="Drag search bar"
            title="Drag to move"
            onPointerDown={onDragStart}
            onPointerMove={onDragMove}
            onPointerUp={onDragEnd}
            onPointerCancel={onDragEnd}
            className="grid w-8 shrink-0 cursor-grab place-items-center rounded-lg border border-[var(--line-default)] text-[var(--ink-4)] shadow-lg backdrop-blur-md transition-colors hover:bg-[var(--hover-fill)] hover:text-[var(--ink-2)] active:cursor-grabbing"
            style={{ background: 'var(--glass-hi)' }}
          >
            <GripVertical className="h-4 w-4" strokeWidth={1.8} />
          </button>
          <div className="min-w-0 flex-1 shadow-lg">
            <SearchBar onPick={(p) => flyToPick(map, p)} />
          </div>
        </div>
        {!pos ? <div className="ml-auto">{actions}</div> : null}
      </div>
      {pos ? (
        <div className="pointer-events-none absolute right-3 top-3 z-20">
          {actions}
        </div>
      ) : null}
    </>
  );
}
