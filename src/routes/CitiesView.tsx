// Cities manager — saved places list + jump to Home / Forecast.

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Trash2 } from 'lucide-react';
import { CitySearch } from '../components/CitySearch';
import { useCities } from '../hooks/useCities';
import { useSettings } from '../hooks/useSettings';
import { useWeather } from '../hooks/useWeather';
import { displayTemp } from '../lib/display';
import type { City } from '../types';

function CityRow({
  city,
  selected,
  onSelect,
  onRemove,
}: {
  city: City;
  selected: boolean;
  onSelect: () => void;
  onRemove: () => void;
}) {
  const { settings } = useSettings();
  const { data } = useWeather(city);
  const temp = data?.data.current.temp;
  const condition = data?.data.current.conditionLabel;

  return (
    <li>
      <div
        className={`flex items-center gap-3 border-b border-[var(--line-subtle)] px-3 py-3 ${
          selected ? 'bg-white/8' : ''
        }`}
      >
        <button
          type="button"
          onClick={onSelect}
          className="min-w-0 flex-1 text-left"
        >
          <div className="truncate text-[14px] font-semibold text-[var(--ink-1)]">
            {city.name}
            {city.isCurrent ? (
              <span className="ml-2 text-[10px] font-bold uppercase tracking-wider text-[var(--accent-2)]">
                Here
              </span>
            ) : null}
          </div>
          <div className="truncate text-[11px] text-[var(--ink-4)]">
            {[city.region, city.country].filter(Boolean).join(', ') ||
              condition ||
              '—'}
          </div>
        </button>
        <span className="tabular text-[18px] font-light text-[var(--ink-1)]">
          {temp !== undefined
            ? displayTemp(temp, settings, { withDegree: false }) + '°'
            : '—'}
        </span>
        {!city.isCurrent ? (
          <button
            type="button"
            aria-label={`Remove ${city.name}`}
            onClick={onRemove}
            className="rounded-lg p-2 text-[var(--ink-4)] hover:bg-white/5 hover:text-[var(--sev-severe)]"
          >
            <Trash2 className="h-4 w-4" strokeWidth={1.8} />
          </button>
        ) : null}
      </div>
    </li>
  );
}

export function CitiesView() {
  const { cities, add, remove, reorder } = useCities();
  const { settings } = useSettings();
  const navigate = useNavigate();
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(
    () => cities.find((c) => c.isCurrent)?.id ?? cities[0]?.id ?? null,
  );
  const active = cities.find((c) => c.id === activeId) ?? cities[0];

  return (
    <div className="absolute inset-0 flex flex-col overflow-hidden">
      <header className="flex items-center gap-3 border-b border-[var(--line-subtle)] px-4 py-3 sm:px-5">
        <div className="mr-auto">
          <p className="card-label">Cities</p>
          <h1 className="text-xl font-semibold text-[var(--ink-1)]">
            Saved places
          </h1>
        </div>
        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-full bg-[var(--accent)] px-3 py-1.5 text-[12px] font-semibold text-white"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={2.2} />
          Add
        </button>
      </header>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[320px_1fr]">
        <aside className="overflow-y-auto border-r border-[var(--line-subtle)]">
          {cities.length === 0 ? (
            <p className="p-4 text-[13px] text-[var(--ink-4)]">
              No cities yet. Add one to get started.
            </p>
          ) : (
            <ul>
              {cities.map((c) => (
                <CityRow
                  key={c.id}
                  city={c}
                  selected={active?.id === c.id}
                  onSelect={() => setActiveId(c.id)}
                  onRemove={() => remove(c.id)}
                />
              ))}
            </ul>
          )}
        </aside>

        <main className="overflow-y-auto p-5">
          {active ? (
            <div className="panel panel-padded mx-auto max-w-lg">
              <h2 className="text-2xl font-semibold text-[var(--ink-1)]">
                {active.name}
              </h2>
              <p className="mt-1 text-[13px] text-[var(--ink-3)]">
                {[active.region, active.country].filter(Boolean).join(', ')}
              </p>
              <p className="mt-3 tabular text-[12px] text-[var(--ink-4)]">
                {active.latitude.toFixed(3)}, {active.longitude.toFixed(3)}
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => navigate(`/city/${active.id}`)}
                  className="rounded-full bg-[var(--accent)] px-4 py-2 text-[12px] font-semibold text-white"
                >
                  Open Home
                </button>
                <Link
                  to="/forecast"
                  className="rounded-full border border-[var(--line-default)] px-4 py-2 text-[12px] font-medium text-[var(--ink-2)]"
                >
                  Forecast
                </Link>
                <Link
                  to="/radar"
                  className="rounded-full border border-[var(--line-default)] px-4 py-2 text-[12px] font-medium text-[var(--ink-2)]"
                >
                  Radar
                </Link>
              </div>
            </div>
          ) : null}
        </main>
      </div>

      <CitySearch
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        cities={cities}
        settings={settings}
        onAdd={(city) => {
          add(city);
          setActiveId(city.id);
          setSearchOpen(false);
        }}
        onRemove={remove}
        onReorder={reorder}
        onSelect={(index) => {
          const c = cities[index];
          if (c) {
            setActiveId(c.id);
            setSearchOpen(false);
          }
        }}
      />
    </div>
  );
}
