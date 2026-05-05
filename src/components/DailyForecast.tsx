import { CalendarDays } from 'lucide-react';
import { Card } from './Card';
import { iconFor } from '../constants/weatherIcons';
import { formatDayLabel, formatTemp } from '../lib/format';
import type { ForecastResponse } from '../types';

interface Props {
  data: ForecastResponse;
  index?: number;
}

interface RangeBarProps {
  dayLow: number;
  dayHigh: number;
  weekLow: number;
  weekHigh: number;
  currentTemp?: number;
}

function RangeBar({
  dayLow,
  dayHigh,
  weekLow,
  weekHigh,
  currentTemp,
}: RangeBarProps) {
  const range = weekHigh - weekLow || 1;
  const startPct = ((dayLow - weekLow) / range) * 100;
  const widthPct = ((dayHigh - dayLow) / range) * 100;
  const currentPct =
    currentTemp !== undefined
      ? Math.min(100, Math.max(0, ((currentTemp - weekLow) / range) * 100))
      : null;

  return (
    <div className="relative h-1.5 w-full rounded-full bg-white/15">
      <div
        className="absolute inset-y-0 rounded-full"
        style={{
          left: `${startPct}%`,
          width: `${widthPct}%`,
          background:
            'linear-gradient(to right, #60a5fa 0%, #fbbf24 50%, #f87171 100%)',
        }}
      />
      {currentPct !== null ? (
        <div
          className="absolute top-1/2 h-2.5 w-2.5 rounded-full bg-white shadow"
          style={{
            left: `${currentPct}%`,
            transform: 'translate(-50%, -50%)',
          }}
        />
      ) : null}
    </div>
  );
}

export function DailyForecast({ data, index }: Props) {
  const days = data.daily.time;
  const lows = data.daily.temperature_2m_min;
  const highs = data.daily.temperature_2m_max;
  const weekLow = Math.min(...lows);
  const weekHigh = Math.max(...highs);
  const currentTemp = data.current.temperature_2m;

  return (
    <Card title="10-Day Forecast" icon={CalendarDays} index={index}>
      <div className="divide-y divide-white/10">
        {days.map((iso, i) => {
          const isToday = i === 0;
          return (
            <div
              key={iso}
              className="flex items-center gap-3 py-2.5"
            >
              <span className="w-14 text-base font-medium text-white">
                {isToday ? 'Today' : formatDayLabel(iso, data.timezone)}
              </span>
              <span className="w-8 text-2xl leading-none">
                {iconFor(data.daily.weather_code[i], 1)}
              </span>
              <span className="tabular w-9 text-right text-base font-medium text-white/60">
                {formatTemp(lows[i])}
              </span>
              <div className="flex-1">
                <RangeBar
                  dayLow={lows[i]}
                  dayHigh={highs[i]}
                  weekLow={weekLow}
                  weekHigh={weekHigh}
                  currentTemp={isToday ? currentTemp : undefined}
                />
              </div>
              <span className="tabular w-9 text-right text-base font-medium text-white">
                {formatTemp(highs[i])}
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
