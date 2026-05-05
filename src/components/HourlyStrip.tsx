import { Clock, Sunrise, Sunset } from 'lucide-react';
import { motion } from 'framer-motion';
import { WeatherIcon } from '../lib/weatherIcons';
import { describeNext24h } from '../lib/forecastNarrative';
import { displayTemp } from '../lib/display';
import { formatHourLabel, formatTime } from '../lib/format';
import type { Settings, WeatherData } from '../types';

interface Props {
  data: WeatherData;
  settings: Settings;
  index?: number;
}

interface HourCell {
  kind: 'hour';
  iso: string;
  temp: number;
  code: number;
  isDay: boolean;
  pop: number;
  label: string;
}

interface SunCell {
  kind: 'sun';
  subtype: 'rise' | 'set';
  time: string;
}

type Cell = HourCell | SunCell;

function buildCells(data: WeatherData): Cell[] {
  const now = Date.now();
  const tz = data.location.timezone;
  const upcoming: HourCell[] = [];
  for (let i = 0; i < data.hourly.length && upcoming.length < 24; i++) {
    const h = data.hourly[i];
    const t = new Date(h.time).getTime();
    if (t < now - 60 * 60_000) continue;
    upcoming.push({
      kind: 'hour',
      iso: h.time,
      temp: h.temp,
      code: h.code,
      isDay: h.isDay,
      pop: h.precipProb,
      label: upcoming.length === 0 ? 'Now' : formatHourLabel(h.time, tz),
    });
  }

  const sunEvents: { time: number; subtype: 'rise' | 'set'; iso: string }[] =
    [];
  for (const day of data.daily) {
    if (day.sunrise) {
      sunEvents.push({
        time: new Date(day.sunrise).getTime(),
        subtype: 'rise',
        iso: day.sunrise,
      });
    }
    if (day.sunset) {
      sunEvents.push({
        time: new Date(day.sunset).getTime(),
        subtype: 'set',
        iso: day.sunset,
      });
    }
  }

  const out: Cell[] = [];
  for (let i = 0; i < upcoming.length; i++) {
    out.push(upcoming[i]);
    const start = new Date(upcoming[i].iso).getTime();
    const next = upcoming[i + 1] ? new Date(upcoming[i + 1].iso).getTime() : null;
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
  const tz = data.location.timezone;

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
              cell.subtype === 'rise' ? 'text-orange-300' : 'text-orange-400';
            return (
              <div
                key={`s-${i}`}
                className="flex w-16 shrink-0 flex-col items-center gap-2 py-2"
              >
                <span className="text-xs font-medium text-white/70">
                  {formatTime(cell.time, tz)}
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
                {displayTemp(cell.temp, settings)}
              </span>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
