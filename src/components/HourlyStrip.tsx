import { Clock, Sunrise, Sunset } from 'lucide-react';
import { motion } from 'framer-motion';
import { WeatherIcon } from '../lib/weatherIcons';
import { describeNext24h } from '../lib/forecastNarrative';
import { formatHourLabel, formatTemp, formatTime } from '../lib/format';
import type { ForecastResponse, Settings } from '../types';

interface Props {
  data: ForecastResponse;
  settings: Settings;
  index?: number;
}

interface HourCell {
  kind: 'hour';
  iso: string;
  temp: number;
  code: number;
  isDay: number;
  pop: number;
  label: string;
}

interface SunCell {
  kind: 'sun';
  subtype: 'rise' | 'set';
  time: string;
}

type Cell = HourCell | SunCell;

function buildCells(data: ForecastResponse): Cell[] {
  const now = new Date(data.current.time).getTime();
  const hours: HourCell[] = [];
  for (let i = 0; i < data.hourly.time.length && hours.length < 24; i++) {
    const t = new Date(data.hourly.time[i]).getTime();
    if (t < now - 60 * 60_000) continue;
    hours.push({
      kind: 'hour',
      iso: data.hourly.time[i],
      temp: data.hourly.temperature_2m[i],
      code: data.hourly.weather_code[i],
      isDay: data.hourly.is_day[i],
      pop: data.hourly.precipitation_probability?.[i] ?? 0,
      label:
        hours.length === 0
          ? 'Now'
          : formatHourLabel(data.hourly.time[i], data.timezone),
    });
  }

  // Splice in sunrise / sunset events that fall within the visible window.
  const sunEvents: { time: number; subtype: 'rise' | 'set'; iso: string }[] =
    [];
  for (const iso of data.daily.sunrise) {
    if (!iso) continue;
    sunEvents.push({ time: new Date(iso).getTime(), subtype: 'rise', iso });
  }
  for (const iso of data.daily.sunset) {
    if (!iso) continue;
    sunEvents.push({ time: new Date(iso).getTime(), subtype: 'set', iso });
  }

  const out: Cell[] = [];
  for (let i = 0; i < hours.length; i++) {
    out.push(hours[i]);
    const start = new Date(hours[i].iso).getTime();
    const next = hours[i + 1] ? new Date(hours[i + 1].iso).getTime() : null;
    if (next === null) continue;
    for (const ev of sunEvents) {
      if (ev.time > start && ev.time <= next) {
        out.push({ kind: 'sun', subtype: ev.subtype, time: ev.iso });
      }
    }
  }
  return out;
}

export function HourlyStrip({ data, settings, index }: Props) {
  const cells = buildCells(data);
  const narrative = describeNext24h(data, settings);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.45,
        delay: (index ?? 0) * 0.08,
        ease: [0.22, 1, 0.36, 1],
      }}
      whileTap={{ scale: 0.98 }}
      className="glass rounded-3xl p-5"
    >
      {narrative ? (
        <>
          <p className="px-1 text-sm leading-relaxed text-white/85">
            {narrative}
          </p>
          <div className="-mx-5 my-4 border-t border-white/10" />
        </>
      ) : null}

      <div className="mb-4 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-white/60">
        <Clock className="h-3.5 w-3.5" strokeWidth={2.2} />
        <span>Hourly Forecast</span>
      </div>

      <div className="-mx-1 flex gap-1 overflow-x-auto no-scrollbar pb-1">
        {cells.map((cell, i) => {
          if (cell.kind === 'sun') {
            const Icon = cell.subtype === 'rise' ? Sunrise : Sunset;
            const label = cell.subtype === 'rise' ? 'Sunrise' : 'Sunset';
            const color =
              cell.subtype === 'rise'
                ? 'text-orange-300'
                : 'text-orange-400';
            return (
              <div
                key={`s-${i}`}
                className="flex w-16 shrink-0 flex-col items-center gap-2 py-2"
              >
                <span className="text-xs font-medium text-white/70">
                  {formatTime(cell.time, data.timezone)}
                </span>
                <Icon size={28} strokeWidth={1.5} className={color} />
                <span className="text-[11px] font-medium text-white/85">
                  {label}
                </span>
              </div>
            );
          }
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
              <WeatherIcon code={cell.code} isDay={cell.isDay} size={28} />
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
    </motion.div>
  );
}
