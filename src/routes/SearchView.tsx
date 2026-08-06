// Full-screen location search.

import { MapPin, Search } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SUGGESTED_CITIES } from '../constants/cities';
import { useCities } from '../hooks/useCities';
import { useGeocode } from '../hooks/useGeocode';
import type { City } from '../types';

export function SearchView() {
  const [q, setQ] = useState('');
  const { results, loading } = useGeocode(q);
  const { add, cities } = useCities();
  const navigate = useNavigate();

  function goToCity(city: City) {
    add(city);
    navigate(`/city/${city.id}`);
  }

  return (
    <div className="absolute inset-0 overflow-y-auto px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-xl">
        <p className="card-label mb-2 text-center">Search</p>
        <h1 className="mb-6 text-center text-2xl font-semibold text-[var(--ink-1)]">
          Find a location
        </h1>

        <div
          className="flex items-center gap-3 rounded-2xl border border-[var(--line-default)] px-4 py-3 backdrop-blur-[28px]"
          style={{ background: 'var(--glass-hi)' }}
        >
          <Search className="h-5 w-5 text-[var(--accent)]" strokeWidth={1.8} />
          <input
            autoFocus
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="City, county, or coordinates"
            className="flex-1 bg-transparent text-[16px] text-[var(--ink-1)] outline-none placeholder:text-[var(--ink-4)]"
          />
        </div>

        <ul className="mt-4 overflow-hidden rounded-2xl border border-[var(--line-default)]"
          style={{ background: 'var(--glass-hi)' }}
        >
          {q.trim() ? (
            loading && results.length === 0 ? (
              <li className="px-4 py-3 text-[13px] text-[var(--ink-4)]">
                Searching…
              </li>
            ) : results.length === 0 ? (
              <li className="px-4 py-3 text-[13px] text-[var(--ink-4)]">
                No results
              </li>
            ) : (
              results.map((r, i) => (
                <li key={`${r.lat},${r.lon},${i}`}>
                  <button
                    type="button"
                    onClick={() =>
                      goToCity({
                        id: `geo-${r.lat.toFixed(3)}-${r.lon.toFixed(3)}`,
                        name: r.label.split(',')[0] ?? r.label,
                        region: r.label,
                        latitude: r.lat,
                        longitude: r.lon,
                      })
                    }
                    className="flex w-full items-center gap-3 border-b border-[var(--line-subtle)] px-4 py-3 text-left last:border-0 hover:bg-white/5"
                  >
                    <MapPin
                      className="h-4 w-4 shrink-0 text-[var(--accent)]"
                      strokeWidth={1.8}
                    />
                    <span className="text-[13px] text-[var(--ink-2)]">
                      {r.label}
                    </span>
                  </button>
                </li>
              ))
            )
          ) : (
            <>
              <li className="px-4 py-2 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--ink-4)]">
                Suggested
              </li>
              {SUGGESTED_CITIES.slice(0, 8).map((c) => {
                const saved = cities.some((x) => x.id === c.id);
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => goToCity(c)}
                      className="flex w-full items-center gap-3 border-b border-[var(--line-subtle)] px-4 py-3 text-left last:border-0 hover:bg-white/5"
                    >
                      <MapPin
                        className="h-4 w-4 shrink-0 text-[var(--accent)]"
                        strokeWidth={1.8}
                      />
                      <span className="flex-1 text-[13px] text-[var(--ink-2)]">
                        {c.name}
                        {c.region ? (
                          <span className="text-[var(--ink-4)]">
                            , {c.region}
                          </span>
                        ) : null}
                      </span>
                      {saved ? (
                        <span className="text-[10px] text-[var(--ink-4)]">
                          Saved
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </>
          )}
        </ul>
      </div>
    </div>
  );
}
