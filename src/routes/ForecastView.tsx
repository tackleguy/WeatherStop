// Dedicated forecast page — daily cards + hourly meteogram for the active city.

import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { DailyForecast } from '../components/DailyForecast';
import { Meteogram } from '../components/Meteogram';
import { INITIAL_SEED } from '../constants/cities';
import { useCities } from '../hooks/useCities';
import { useSettings } from '../hooks/useSettings';
import { useWeather } from '../hooks/useWeather';

export function ForecastView() {
  const { cities } = useCities();
  const { settings } = useSettings();
  const city = useMemo(
    () => cities.find((c) => c.isCurrent) ?? cities[0] ?? INITIAL_SEED[0],
    [cities],
  );
  const { data, error, refresh } = useWeather(city);

  return (
    <div className="absolute inset-0 overflow-y-auto px-4 py-5 sm:px-6">
      <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="card-label mb-1">Forecast</p>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--ink-1)]">
            {city?.name ?? '—'}
          </h1>
        </div>
        <div className="flex gap-2">
          <Link
            to="/cities"
            className="rounded-full border border-[var(--line-default)] px-3 py-1.5 text-[12px] font-medium text-[var(--ink-2)] hover:bg-white/5"
          >
            Change city
          </Link>
          <button
            type="button"
            onClick={refresh}
            className="rounded-full bg-[var(--accent)] px-3 py-1.5 text-[12px] font-semibold text-white"
          >
            Refresh
          </button>
        </div>
      </header>

      {error && !data ? (
        <div className="panel panel-padded text-[var(--ink-2)]">
          Couldn’t load forecast.{' '}
          <button type="button" className="underline" onClick={refresh}>
            Retry
          </button>
        </div>
      ) : !data ? (
        <div className="space-y-3">
          <div className="h-48 rounded-2xl bg-white/5 shimmer" />
          <div className="h-64 rounded-2xl bg-white/5 shimmer" />
        </div>
      ) : (
        <div className="mx-auto flex max-w-4xl flex-col gap-4 pb-10">
          <Meteogram data={data.data} settings={settings} index={0} />
          <DailyForecast data={data.data} settings={settings} index={1} />
        </div>
      )}
    </div>
  );
}
