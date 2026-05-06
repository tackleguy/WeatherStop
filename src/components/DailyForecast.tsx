import { CalendarDays } from 'lucide-react';
import { Card } from './Card';
import { WeatherIcon } from '../lib/weatherIcons';
import { displayTemp } from '../lib/display';
import { formatDayLabel } from '../lib/format';
import { weekHeadline } from '../lib/dayNarrative';
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
  const avgF = (low + high) / 2;
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
    <div className="relative h-1 w-full rounded-full bg-white/10">
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
          aria-hidden
          className="absolute top-1/2 h-3 w-[2px] -translate-y-1/2 rounded-sm bg-white shadow"
          style={{ left: `${currentPct}%`, transform: 'translate(-50%, -50%)' }}
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

  const meta = `${displayTemp(data.today.high, settings)} / ${displayTemp(data.today.low, settings)}`;
  const headline = weekHeadline(data);

  return (
    <Card
      title="10-Day Forecast"
      icon={CalendarDays}
      index={index}
      meta={meta}
    >
      {headline ? (
        <p className="mb-2 px-1 text-[12px] text-white/65">{headline}</p>
      ) : null}
      <div className="-mx-1">
        {days.map((day, i) => {
          const isToday = i === 0;
          return (
            <div
              key={day.date}
              className="grid grid-cols-[60px_24px_36px_1fr_36px] items-center gap-3 rounded-lg px-1 py-1.5 transition-colors duration-200 hover:bg-white/[0.05]"
              style={{ minHeight: 32 }}
            >
              <span className="text-[14px] font-medium text-white">
                {isToday ? 'Today' : formatDayLabel(day.date, data.location.timezone)}
              </span>
              <span>
                <WeatherIcon code={day.code} isDay size={20} />
              </span>
              <span className="tabular text-right text-[13px] font-medium text-white/55">
                {displayTemp(day.low, settings)}
              </span>
              <RangeBar
                dayLow={day.low}
                dayHigh={day.high}
                weekLow={weekLow}
                weekHigh={weekHigh}
                fillColor={rangeBarColor(day.low, day.high)}
                currentTemp={isToday ? currentTemp : undefined}
              />
              <span className="tabular text-right text-[13px] font-medium text-white">
                {displayTemp(day.high, settings)}
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
