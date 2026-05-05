import { CloudRain } from 'lucide-react';
import { Card } from './Card';
import { formatHourLabel, formatPrecip, formatTime } from '../lib/format';
import type { ForecastResponse, Settings } from '../types';

interface Props {
  data: ForecastResponse;
  settings: Settings;
  index?: number;
}

export function PrecipitationCard({ data, settings, index }: Props) {
  const now = new Date(data.current.time).getTime();

  // Last 24h total — we don't have past hours in this fetch, so show today's daily sum.
  const todayTotal = data.daily.precipitation_sum[0] ?? 0;

  // Next 24h slice
  const slice: { iso: string; amt: number; pop: number }[] = [];
  for (let i = 0; i < data.hourly.time.length && slice.length < 24; i++) {
    const t = new Date(data.hourly.time[i]).getTime();
    if (t < now - 60 * 60_000) continue;
    slice.push({
      iso: data.hourly.time[i],
      amt: data.hourly.precipitation[i] ?? 0,
      pop: data.hourly.precipitation_probability?.[i] ?? 0,
    });
  }

  const peak = slice.reduce((m, h) => Math.max(m, h.amt), 0);

  const nextRain = slice.find((h) => h.amt > 0.01 || h.pop >= 50);
  const nextLabel = nextRain
    ? `Rain expected ${formatTime(nextRain.iso, data.timezone)}`
    : null;

  return (
    <Card title="Precipitation" icon={CloudRain} index={index}>
      <div className="flex items-baseline gap-2">
        <span className="tabular text-3xl font-light text-white">
          {formatPrecip(todayTotal, settings.precip)}
        </span>
        <span className="text-[13px] text-white/65">today total</span>
      </div>

      <div className="mt-4 flex items-end gap-1">
        {slice.map((h, i) => {
          const heightFromAmt = peak > 0 ? (h.amt / peak) * 100 : 0;
          const heightFromPop = h.pop * 0.35;
          const height = Math.max(heightFromAmt, heightFromPop);
          return (
            <div key={h.iso} className="flex flex-1 flex-col items-center gap-1">
              <div className="flex h-12 w-full items-end overflow-hidden rounded-sm bg-white/5">
                <div
                  className="w-full rounded-sm bg-sky-300/85"
                  style={{ height: `${Math.min(100, height)}%`, minHeight: h.amt > 0 ? 2 : 0 }}
                />
              </div>
              {i % 4 === 0 ? (
                <span className="text-[9px] font-medium text-white/55">
                  {formatHourLabel(h.iso, data.timezone)}
                </span>
              ) : (
                <span className="h-[10px]" />
              )}
            </div>
          );
        })}
      </div>

      {nextLabel ? (
        <p className="mt-3 text-[13px] text-white/80">{nextLabel}</p>
      ) : (
        <p className="mt-3 text-[13px] text-white/65">No precipitation expected in next 24h.</p>
      )}
    </Card>
  );
}
