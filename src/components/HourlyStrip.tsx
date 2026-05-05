import { Clock } from 'lucide-react';
import { Card } from './Card';
import { iconFor } from '../constants/weatherIcons';
import { formatHourLabel, formatTemp } from '../lib/format';
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

export function HourlyStrip({ data, index }: Props) {
  const cells = buildHourCells(data);

  return (
    <Card title="Hourly Forecast" icon={Clock} index={index}>
      <div className="-mx-1 flex gap-1 overflow-x-auto no-scrollbar pb-1">
        {cells.map((cell, i) => {
          const isNow = i === 0;
          return (
            <div
              key={cell.iso}
              className={`flex w-14 shrink-0 flex-col items-center gap-2 rounded-2xl py-2 ${
                isNow ? 'bg-white/10' : ''
              }`}
            >
              <span className="text-xs font-medium text-white/70">
                {cell.label}
              </span>
              <span className="text-2xl leading-none">
                {iconFor(cell.code, cell.isDay)}
              </span>
              <span
                className={`text-[10px] font-medium ${
                  cell.pop >= 20 ? 'text-blue-300' : 'invisible'
                }`}
              >
                {cell.pop >= 20 ? `${Math.round(cell.pop)}%` : '0%'}
              </span>
              <span className="tabular text-base font-semibold text-white">
                {formatTemp(cell.temp)}
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
