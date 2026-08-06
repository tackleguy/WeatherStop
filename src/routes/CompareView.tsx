// Side-by-side city comparison page.

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { describeCondition } from '../lib/describeCondition';
import { displayTemp, displayWindSpeed } from '../lib/display';
import { WeatherIcon } from '../lib/weatherIcons';
import { useCities } from '../hooks/useCities';
import { useSettings } from '../hooks/useSettings';
import { useWeather } from '../hooks/useWeather';
import type { City, Settings } from '../types';

const MAX_COLS = 4;

export function CompareView() {
  const { cities } = useCities();
  const { settings } = useSettings();
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

  function toggle(id: string) {
    setPicked((prev) => {
      if (prev.includes(id)) return prev.filter((p) => p !== id);
      if (prev.length >= MAX_COLS) return [...prev.slice(1), id];
      return [...prev, id];
    });
  }

  return (
    <div className="absolute inset-0 overflow-y-auto px-4 py-5 sm:px-6">
      <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="card-label mb-1">Compare</p>
          <h1 className="text-2xl font-semibold text-[var(--ink-1)]">
            Side-by-side
          </h1>
        </div>
        <Link
          to="/cities"
          className="rounded-full border border-[var(--line-default)] px-3 py-1.5 text-[12px] text-[var(--ink-2)]"
        >
          Manage cities
        </Link>
      </header>

      <div className="mb-4 flex flex-wrap gap-2">
        {cities.map((c) => {
          const on = picked.includes(c.id);
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => toggle(c.id)}
              className={`rounded-full px-3 py-1.5 text-[12px] font-semibold ${
                on
                  ? 'bg-[var(--accent)] text-white'
                  : 'border border-[var(--line-default)] text-[var(--ink-3)]'
              }`}
            >
              {c.name}
            </button>
          );
        })}
      </div>

      {pickedCities.length === 0 ? (
        <p className="text-[13px] text-[var(--ink-4)]">
          Select up to {MAX_COLS} cities to compare.
        </p>
      ) : (
        <div
          className="grid gap-3"
          style={{
            gridTemplateColumns: `repeat(${pickedCities.length}, minmax(160px, 1fr))`,
          }}
        >
          {pickedCities.map((c) => (
            <CompareColumn key={c.id} city={c} settings={settings} />
          ))}
        </div>
      )}
    </div>
  );
}

function CompareColumn({
  city,
  settings,
}: {
  city: City;
  settings: Settings;
}) {
  const { data, loading } = useWeather(city);
  const w = data?.data;

  if (loading || !w) {
    return (
      <div className="panel panel-padded">
        <div className="text-[13px] font-semibold text-[var(--ink-1)]">
          {city.name}
        </div>
        <div className="mt-2 h-24 rounded shimmer" />
      </div>
    );
  }

  return (
    <div className="panel panel-padded">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="truncate text-[15px] font-semibold text-[var(--ink-1)]">
            {city.name}
          </h2>
          {city.region ? (
            <p className="text-[11px] text-[var(--ink-4)]">{city.region}</p>
          ) : null}
        </div>
        <WeatherIcon code={w.current.code} isDay={w.current.isDay} size={22} />
      </div>

      <div className="tabular mt-3 text-4xl font-light text-[var(--ink-1)]">
        {displayTemp(w.current.temp, settings, { withDegree: false })}°
      </div>
      <p className="mt-1 text-[12px] text-[var(--ink-3)]">
        {describeCondition(w.current.temp, w.current.code)}
      </p>

      <dl className="mt-4 space-y-2 text-[12px]">
        <Row
          label="Feels like"
          value={displayTemp(w.current.feelsLike, settings)}
        />
        <Row label="Wind" value={displayWindSpeed(w.current.windSpeed, settings)} />
        <Row label="Humidity" value={`${Math.round(w.current.humidity)}%`} />
        <Row
          label="High / Low"
          value={`${displayTemp(w.today.high, settings)} / ${displayTemp(w.today.low, settings)}`}
        />
      </dl>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2 border-t border-[var(--line-subtle)] pt-2">
      <dt className="text-[var(--ink-4)]">{label}</dt>
      <dd className="tabular font-medium text-[var(--ink-1)]">{value}</dd>
    </div>
  );
}
