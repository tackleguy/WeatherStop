// Map click-to-inspect popup. Shows lat/lon, surface forecast values when
// Wind/Temp is active, and any alerts covering the point.

import { Crosshair, MapPin, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAlerts } from '../../hooks/useAlerts';
import { formatLatLon, geometryBBox, pointInBBox } from '../../lib/geo';
import { severityColor } from '../../lib/colorTables';
import { alertsPageHref } from '../../lib/alertsNav';
import { useRadarStore } from '../../store/useRadarStore';
import { isForecastProduct, useTimeFrames } from '../../hooks/useTimeFrames';
import { formatTime } from '../../lib/time';

interface SurfaceSample {
  label: string;
  value: string;
}

export function ClickInspector() {
  const at = useRadarStore((s) => s.inspectAt);
  const close = useRadarStore((s) => s.setInspectAt);
  const focusAlert = useRadarStore((s) => s.focusAlert);
  const activeProduct = useRadarStore((s) => s.activeProduct);
  const currentFrameIdx = useRadarStore((s) => s.currentFrameIdx);
  const frames = useTimeFrames();
  const navigate = useNavigate();
  const { alerts } = useAlerts();
  const [surface, setSurface] = useState<SurfaceSample | null>(null);
  const [surfaceLoading, setSurfaceLoading] = useState(false);

  const hits = useMemo(() => {
    if (!at) return [];
    return alerts.filter((a) => {
      const bbox = geometryBBox(a.geometry);
      if (!bbox) return false;
      return pointInBBox(at, bbox);
    });
  }, [alerts, at]);

  const forecast = isForecastProduct(activeProduct);
  const ts = frames[currentFrameIdx] ?? frames[frames.length - 1];
  const hourIso = ts
    ? new Date(Math.floor(ts / 3600) * 3600 * 1000)
        .toISOString()
        .slice(0, 13)
    : null;

  useEffect(() => {
    if (!at || !forecast || !hourIso) {
      setSurface(null);
      return;
    }
    const [lon, lat] = at;
    let cancelled = false;
    setSurfaceLoading(true);
    const fields =
      activeProduct === 'wind'
        ? 'wind_speed_10m,wind_direction_10m'
        : 'temperature_2m';
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}` +
      `&longitude=${lon.toFixed(4)}&hourly=${fields}` +
      `&start_hour=${encodeURIComponent(hourIso)}` +
      `&end_hour=${encodeURIComponent(hourIso)}` +
      `&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=UTC`;

    void fetch(url)
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        const json = (await res.json()) as {
          hourly?: {
            time?: string[];
            wind_speed_10m?: (number | null)[];
            wind_direction_10m?: (number | null)[];
            temperature_2m?: (number | null)[];
          };
        };
        if (cancelled) return;
        if (activeProduct === 'wind') {
          const mph = json.hourly?.wind_speed_10m?.[0];
          const dir = json.hourly?.wind_direction_10m?.[0];
          if (typeof mph !== 'number') {
            setSurface(null);
            return;
          }
          const compass =
            typeof dir === 'number'
              ? ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][
                  Math.round(dir / 45) % 8
                ]
              : '';
          setSurface({
            label: `Wind · ${formatTime(ts)}`,
            value: `${Math.round(mph)} mph${compass ? ` ${compass}` : ''}`,
          });
        } else {
          const f = json.hourly?.temperature_2m?.[0];
          if (typeof f !== 'number') {
            setSurface(null);
            return;
          }
          setSurface({
            label: `Temp · ${formatTime(ts)}`,
            value: `${Math.round(f)}°F`,
          });
        }
      })
      .catch(() => {
        if (!cancelled) setSurface(null);
      })
      .finally(() => {
        if (!cancelled) setSurfaceLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [at, forecast, hourIso, activeProduct, ts]);

  if (!at) return null;

  return (
    <div
      className="pointer-events-auto absolute bottom-24 left-1/2 z-20 w-80 -translate-x-1/2 rounded-xl border border-[var(--line-default)] backdrop-blur-md"
      style={{ background: 'var(--glass-hi)' }}
    >
      <header className="flex items-center justify-between border-b border-[var(--line-subtle)] px-3 py-2">
        <div className="flex items-center gap-1.5 text-[var(--ink-2)]">
          <Crosshair className="h-3.5 w-3.5" strokeWidth={1.8} />
          <span className="text-[11px] font-semibold uppercase tracking-wider">
            Inspect
          </span>
        </div>
        <button
          type="button"
          aria-label="Close"
          onClick={() => close(null)}
          className="grid h-6 w-6 place-items-center rounded text-[var(--ink-3)] hover:bg-[var(--hover-fill)] hover:text-[var(--ink-1)]"
        >
          <X className="h-3 w-3" strokeWidth={2.2} />
        </button>
      </header>

      <div className="px-3 py-3">
        <div className="flex items-center gap-2 text-[12px] text-[var(--ink-1)]">
          <MapPin className="h-3.5 w-3.5 text-[var(--accent)]" strokeWidth={2} />
          <span data-num>{formatLatLon(at[1], at[0])}</span>
        </div>

        {forecast ? (
          <div className="mt-3 rounded-lg border border-[var(--line-subtle)] bg-[var(--hover-fill)] px-3 py-2">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--ink-3)]">
              {surface?.label ??
                (activeProduct === 'wind' ? 'Wind forecast' : 'Temp forecast')}
            </div>
            <div data-num className="mt-0.5 text-[18px] font-light text-[var(--ink-1)]">
              {surfaceLoading ? '…' : (surface?.value ?? '—')}
            </div>
          </div>
        ) : null}

        <div className="mt-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--ink-3)]">
            Active alerts at this point
          </div>
          {hits.length === 0 ? (
            <div className="mt-1 text-[12px] text-[var(--ink-3)]">
              No alerts in effect.
            </div>
          ) : (
            <ul className="mt-2 space-y-1">
              {hits.slice(0, 6).map((a) => (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => {
                      focusAlert(a.id);
                      close(null);
                      navigate(alertsPageHref(a.id));
                    }}
                    className="flex w-full items-start gap-2 rounded px-1.5 py-1 text-left transition-colors hover:bg-[var(--hover-fill)]"
                  >
                    <span
                      className="mt-1 h-2 w-2 shrink-0 rounded-full"
                      style={{ background: severityColor(a.severity) }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[12px] font-medium text-[var(--ink-1)]">
                        {a.event}
                      </div>
                      <div className="truncate text-[10px] text-[var(--ink-3)]">
                        {a.areaDesc}
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
