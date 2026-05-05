import { CalendarDays } from 'lucide-react';
import { Card } from './Card';
import { WeatherIcon } from '../lib/weatherIcons';
import { displayTemp } from '../lib/display';
import { formatDayLabel } from '../lib/format';
import type { Settings, WeatherData } from '../types';

interface Props {
  data: WeatherData;
  settings: Settings;
  index?: number;
}

interface RangeBarProps {
  dayLow: number;
  dayHigh: number;
  weekLow: number;
  weekHigh: number;
  fillColor: string;
  currentTemp?: number;
}

function rangeBarColor(low: number, high: number): string {
  const avgF = (low + high) / 2; // canonical °F
  if (avgF < 35) return 'linear-gradient(to right, #60a5fa, #93c5fd)';
  if (avgF < 50) return 'linear-gradient(to right, #67e8f9, #a5f3fc)';
  if (avgF < 65) return 'linear-gradient(to right, #34d399, #a7f3d0)';
  if (avgF < 78) return 'linear-gradient(to right, #fbbf24, #fde68a)';
  if (avgF < 90) return 'linear-gradient(to right, #fb923c, #fdba74)';
  return 'linear-gradient(to right, #ef4444, #fca5a5)';
}

function RangeBar({
  dayLow,
  dayHigh,
  weekLow,
  weekHigh,
  fillColor,
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
          background: fillColor,
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

export function DailyForecast({ data, settings, index }: Props) {
  const days = data.daily;
  const weekLow = Math.min(...days.map((d) => d.low));
  const weekHigh = Math.max(...days.map((d) => d.high));
  const currentTemp = data.current.temp;

  return (
    <Card title="10-Day Forecast" icon={CalendarDays} index={index}>
      <div className="divide-y divide-white/10">
        {days.map((day, i) => {
          const isToday = i === 0;
          return (
            <div key={day.date} className="flex items-center gap-3 py-2.5">
              <span className="w-14 text-base font-medium text-white">
                {isToday
                  ? 'Today'
                  : formatDayLabel(day.date, data.location.timezone)}
              </span>
              <span className="w-8">
                <WeatherIcon code={day.code} isDay size={26} />
              </span>
              <span className="tabular w-9 text-right text-base font-medium text-white/60">
                {displayTemp(day.low, settings)}
              </span>
              <div className="flex-1">
                <RangeBar
                  dayLow={day.low}
                  dayHigh={day.high}
                  weekLow={weekLow}
                  weekHigh={weekHigh}
                  fillColor={rangeBarColor(day.low, day.high)}
                  currentTemp={isToday ? currentTemp : undefined}
                />
              </div>
              <span className="tabular w-9 text-right text-base font-medium text-white">
                {displayTemp(day.high, settings)}
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
