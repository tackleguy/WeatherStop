import { CloudRain } from 'lucide-react';
import { Card } from './Card';
import { formatHourLabel, formatTime } from '../lib/format';
import type { WeatherData } from '../types';

interface Props {
  data: WeatherData;
  index?: number;
}

export function PrecipitationCard({ data, index }: Props) {
  const tz = data.location.timezone;
  const now = Date.now();

  const slice = data.hourly
    .filter((h) => new Date(h.time).getTime() >= now - 60 * 60_000)
    .slice(0, 24);

  const peakProb = slice.reduce((m, h) => Math.max(m, h.precipProb), 0);
  const nextRain = slice.find((h) => h.precipProb >= 50);
  const nextLabel = nextRain
    ? `Rain expected ${formatTime(nextRain.time, tz)}`
    : null;

  return (
    <Card title="Precipitation" icon={CloudRain} index={index}>
      <div className="flex items-baseline gap-2">
        <span className="tabular text-3xl font-light text-white">
          {Math.round(peakProb)}%
        </span>
        <span className="text-[13px] text-white/65">peak chance next 24h</span>
      </div>

      <div className="mt-4 flex items-end gap-1">
        {slice.map((h, i) => {
          const height = h.precipProb;
          return (
            <div key={h.time} className="flex flex-1 flex-col items-center gap-1">
              <div className="flex h-12 w-full items-end overflow-hidden rounded-sm bg-white/5">
                <div
                  className="w-full rounded-sm bg-sky-300/85"
                  style={{ height: `${Math.min(100, height)}%` }}
                />
              </div>
              {i % 4 === 0 ? (
                <span className="text-[9px] font-medium text-white/55">
                  {formatHourLabel(h.time, tz)}
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
        <p className="mt-3 text-[13px] text-white/65">
          No precipitation expected in next 24h.
        </p>
      )}
    </Card>
  );
}
