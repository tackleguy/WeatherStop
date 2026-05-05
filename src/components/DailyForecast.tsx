import { CalendarDays } from 'lucide-react';
import { Card } from './Card';
import { iconFor } from '../constants/weatherIcons';
import { formatDayLabel, formatTemp } from '../lib/format';
import type { ForecastResponse } from '../types';

interface Props {
  data: ForecastResponse;
  index?: number;
}

export function DailyForecast({ data, index }: Props) {
  const days = data.daily.time;
  const lows = data.daily.temperature_2m_min;
  const highs = data.daily.temperature_2m_max;
  const overallMin = Math.min(...lows);
  const overallMax = Math.max(...highs);
  const span = overallMax - overallMin || 1;
  const currentTemp = data.current.temperature_2m;

  return (
    <Card title="10-Day Forecast" icon={CalendarDays} index={index}>
      <div className="divide-y divide-white/10">
        {days.map((iso, i) => {
          const isToday = i === 0;
          const lo = lows[i];
          const hi = highs[i];
          const startPct = ((lo - overallMin) / span) * 100;
          const widthPct = ((hi - lo) / span) * 100;

          const dotPct =
            isToday
              ? Math.min(
                  100,
                  Math.max(0, ((currentTemp - overallMin) / span) * 100),
                )
              : null;

          return (
            <div key={iso} className="grid grid-cols-[64px_28px_36px_1fr_36px] items-center gap-3 py-3">
              <div className="text-[15px] font-medium text-white">
                {isToday ? 'Today' : formatDayLabel(iso, data.timezone)}
              </div>
              <div className="text-xl leading-none">
                {iconFor(data.daily.weather_code[i], 1)}
              </div>
              <div className="tabular text-right text-[15px] font-light text-white/55">
                {formatTemp(lo)}
              </div>
              <div className="relative h-[6px] rounded-full bg-white/15">
                <div
                  className="absolute inset-y-0 rounded-full bg-gradient-to-r from-sky-400 via-emerald-300 to-orange-400"
                  style={{ left: `${startPct}%`, width: `${widthPct}%` }}
                />
                {dotPct !== null ? (
                  <div
                    className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/60 bg-white"
                    style={{ left: `${dotPct}%` }}
                  />
                ) : null}
              </div>
              <div className="tabular text-right text-[15px] font-medium text-white">
                {formatTemp(hi)}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
