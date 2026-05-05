import { Clock } from 'lucide-react';
import { Card } from './Card';
import { iconFor } from '../constants/weatherIcons';
import { formatHourLabel, formatTemp, formatTime } from '../lib/format';
import type { ForecastResponse } from '../types';

interface Props {
  data: ForecastResponse;
  index?: number;
}

interface HourCell {
  iso: string;
  temp: number;
  code: number;
  isDay: number;
  pop: number;
  label: string;
}

function buildHourCells(data: ForecastResponse): HourCell[] {
  const now = new Date(data.current.time).getTime();
  const cells: HourCell[] = [];
  for (let i = 0; i < data.hourly.time.length && cells.length < 24; i++) {
    const t = new Date(data.hourly.time[i]).getTime();
    if (t < now - 60 * 60_000) continue;
    cells.push({
      iso: data.hourly.time[i],
      temp: data.hourly.temperature_2m[i],
      code: data.hourly.weather_code[i],
      isDay: data.hourly.is_day[i],
      pop: data.hourly.precipitation_probability?.[i] ?? 0,
      label:
        cells.length === 0
          ? 'Now'
          : formatHourLabel(data.hourly.time[i], data.timezone),
    });
  }
  return cells;
}

interface SunMark {
  index: number;
  kind: 'sunrise' | 'sunset';
  time: string;
}

function findSunMarks(cells: HourCell[], data: ForecastResponse): SunMark[] {
  const marks: SunMark[] = [];
  if (cells.length === 0) return marks;
  const start = new Date(cells[0].iso).getTime();
  const end = new Date(cells[cells.length - 1].iso).getTime() + 60 * 60_000;

  data.daily.sunrise.forEach((iso) => {
    const t = new Date(iso).getTime();
    if (t >= start && t <= end) {
      const idx = cells.findIndex((c) => new Date(c.iso).getTime() >= t);
      if (idx >= 0) marks.push({ index: idx, kind: 'sunrise', time: iso });
    }
  });
  data.daily.sunset.forEach((iso) => {
    const t = new Date(iso).getTime();
    if (t >= start && t <= end) {
      const idx = cells.findIndex((c) => new Date(c.iso).getTime() >= t);
      if (idx >= 0) marks.push({ index: idx, kind: 'sunset', time: iso });
    }
  });
  return marks;
}

export function HourlyStrip({ data, index }: Props) {
  const cells = buildHourCells(data);
  const sunMarks = findSunMarks(cells, data);

  return (
    <Card title="Hourly Forecast" icon={Clock} index={index}>
      <div className="-mx-2 overflow-x-auto no-scrollbar">
        <div className="flex items-end gap-2 px-2 pb-1">
          {cells.map((cell, i) => {
            const sun = sunMarks.find((s) => s.index === i);
            return (
              <div
                key={cell.iso}
                className="flex w-14 shrink-0 flex-col items-center gap-1.5"
              >
                <div className="text-[12px] font-medium text-white/80">{cell.label}</div>
                <div className="text-2xl leading-none">
                  {iconFor(cell.code, cell.isDay)}
                </div>
                {cell.pop >= 20 ? (
                  <div className="text-[10px] font-medium text-sky-200/85 tabular">
                    {Math.round(cell.pop)}%
                  </div>
                ) : (
                  <div className="h-[14px]" />
                )}
                <div className="tabular text-[15px] font-medium text-white">
                  {formatTemp(cell.temp)}
                </div>
                <div className="mt-1 h-[3px] w-10 overflow-hidden rounded-full bg-white/15">
                  <div
                    className="h-full bg-sky-300/85"
                    style={{ width: `${Math.max(0, Math.min(100, cell.pop))}%` }}
                  />
                </div>
                {sun ? (
                  <div className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-200/95">
                    {sun.kind === 'sunrise' ? '↑' : '↓'}{' '}
                    {formatTime(sun.time, data.timezone)}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
