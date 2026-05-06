// Side-by-side compare for up to 4 saved cities. Each column renders
// the same dataset the hero already shows (current temp, today H/L,
// next-hour precip prob, wind, AQI). Useful for trip planning.

import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { describeCondition } from '../lib/describeCondition';
import { displayTemp, displayWindSpeed } from '../lib/display';
import { WeatherIcon } from '../lib/weatherIcons';
import { useWeather } from '../hooks/useWeather';
import type { City, Settings } from '../types';

interface Props {
  open: boolean;
  onClose: () => void;
  cities: City[];
  settings: Settings;
}

const MAX_COLS = 4;

export function CompareModal({ open, onClose, cities, settings }: Props) {
  const [picked, setPicked] = useState<string[]>(() =>
    cities.slice(0, Math.min(MAX_COLS, cities.length)).map((c) => c.id),
  );

  const pickedCities = useMemo(
    () =>
      picked
        .map((id) => cities.find((c) => c.id === id))
        .filter((c): c is City => Boolean(c)),
    [picked, cities],
  );

  const togglePick = (id: string) => {
    setPicked((prev) => {
      if (prev.includes(id)) return prev.filter((p) => p !== id);
      if (prev.length >= MAX_COLS) return prev;
      return [...prev, id];
    });
  };

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="compare"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 24, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="mx-auto flex h-full max-w-5xl flex-col px-4 pb-6 pt-12"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-semibold text-white">Compare</h2>
                <p className="text-[12px] text-white/55">
                  Pick up to {MAX_COLS} cities to view side-by-side.
                </p>
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={onClose}
                className="grid h-9 w-9 place-items-center rounded-full bg-white/15 text-white hover:bg-white/25"
              >
                <X className="h-4 w-4" strokeWidth={2.5} />
              </button>
            </header>

            <PickerStrip
              cities={cities}
              picked={picked}
              togglePick={togglePick}
            />

            <div className="mt-4 grid flex-1 gap-3 overflow-y-auto sm:grid-cols-2 lg:grid-cols-4">
              {pickedCities.map((c) => (
                <CompareColumn key={c.id} city={c} settings={settings} />
              ))}
              {pickedCities.length === 0 ? (
                <div className="col-span-full px-2 py-6 text-center text-sm text-white/55">
                  Pick at least one city above.
                </div>
              ) : null}
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function PickerStrip({
  cities,
  picked,
  togglePick,
}: {
  cities: City[];
  picked: string[];
  togglePick: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {cities.map((c) => {
        const active = picked.includes(c.id);
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => togglePick(c.id)}
            className={`rounded-full border px-3 py-1.5 text-[13px] font-medium transition ${
              active
                ? 'border-white/30 bg-white text-slate-900'
                : 'border-white/15 bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            {c.name}
          </button>
        );
      })}
    </div>
  );
}

function CompareColumn({ city, settings }: { city: City; settings: Settings }) {
  const { data, loading } = useWeather(city);
  const w = data?.data;

  if (loading || !w) {
    return (
      <div className="panel panel-padded">
        <div className="text-[13px] font-semibold text-white">{city.name}</div>
        <div className="mt-2 h-24 rounded shimmer" />
        <div className="mt-2 h-3 w-1/2 rounded shimmer" />
      </div>
    );
  }

  return (
    <div className="panel panel-padded">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-[14px] font-semibold text-white">{city.name}</div>
          {city.region ? (
            <div className="text-[11px] text-white/55">{city.region}</div>
          ) : null}
        </div>
        <WeatherIcon code={w.current.code} isDay={w.current.isDay} size={22} />
      </div>

      <div className="tabular mt-3 text-5xl font-thin tracking-tight text-white">
        {displayTemp(w.current.temp, settings, { withDegree: false })}°
      </div>

      <div className="mt-1 text-[12px] text-white/65">
        {describeCondition(w.current.temp, w.current.code)}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
        <CompareStat
          label="High / Low"
          value={`${displayTemp(w.today.high, settings)} / ${displayTemp(w.today.low, settings)}`}
        />
        <CompareStat
          label="Wind"
          value={displayWindSpeed(w.current.windSpeed, settings)}
        />
        <CompareStat
          label="Humidity"
          value={`${Math.round(w.current.humidity)}%`}
        />
        <CompareStat
          label="Precip 24h"
          value={`${Math.round(w.today.precipProbMax)}%`}
        />
      </div>

      <details className="mt-3 group">
        <summary className="flex cursor-pointer items-center gap-1 text-[11px] font-medium uppercase tracking-wider text-white/55 hover:text-white/85">
          Hourly preview
          <ChevronDown className="h-3 w-3 transition-transform group-open:rotate-180" strokeWidth={2.4} />
        </summary>
        <div className="mt-2 grid grid-cols-6 gap-1 text-center">
          {w.hourly.slice(0, 12).map((h, i) => (
            <div key={i} className="rounded bg-white/[0.04] py-1">
              <div className="text-[9px] font-medium text-white/55">
                {new Date(h.time).toLocaleTimeString('en-US', { hour: 'numeric' })}
              </div>
              <div className="tabular text-[11px] font-medium text-white">
                {displayTemp(h.temp, settings)}
              </div>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}

function CompareStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[9px] font-semibold uppercase tracking-[0.12em] text-white/55">
        {label}
      </div>
      <div className="tabular mt-0.5 text-[13px] font-medium text-white">
        {value}
      </div>
    </div>
  );
}
