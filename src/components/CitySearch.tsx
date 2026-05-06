import { AnimatePresence, motion } from 'framer-motion';
import { MapPin, Search, Trash2, X, GripVertical } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { SUGGESTED_CITIES } from '../constants/cities';
import { debouncedSearch } from '../lib/geocoding';
import { fetchOpenMeteoRaw } from '../lib/openMeteo';
import { displayTemp } from '../lib/display';
import { WeatherIcon } from '../lib/weatherIcons';
import type { City, GeocodingResult, Settings } from '../types';

interface Props {
  open: boolean;
  onClose: () => void;
  cities: City[];
  onAdd: (city: City) => void;
  onRemove: (id: string) => void;
  onReorder: (from: number, to: number) => void;
  onSelect: (index: number) => void;
  settings: Settings;
}

interface ResultRow extends GeocodingResult {
  liveTemp?: number;
  liveCode?: number;
}

function toCity(result: GeocodingResult): City {
  return {
    id: `${result.id}-${result.latitude.toFixed(3)}-${result.longitude.toFixed(3)}`,
    name: result.name,
    region: result.admin1,
    country: result.country,
    countryCode: result.country_code,
    latitude: result.latitude,
    longitude: result.longitude,
    timezone: result.timezone,
  };
}

export function CitySearch({
  open,
  onClose,
  cities,
  onAdd,
  onRemove,
  onReorder,
  onSelect,
  settings,
}: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ResultRow[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounce = useMemo(() => debouncedSearch(300), []);
  const fetchTokenRef = useRef(0);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setResults([]);
    const id = window.setTimeout(() => inputRef.current?.focus(), 80);
    return () => window.clearTimeout(id);
  }, [open]);

  // Run search whenever the query changes.
  useEffect(() => {
    if (!open) return;
    if (query.trim().length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    debounce(
      query,
      async (rows) => {
        setResults(rows.map((r) => ({ ...r })));
        setLoading(false);
        const token = ++fetchTokenRef.current;

        // Hydrate live temps in parallel.
        const enriched = await Promise.all(
          rows.map(async (r) => {
            try {
              const f = await fetchOpenMeteoRaw(r.latitude, r.longitude);
              return {
                ...r,
                liveTemp: f.current.temperature_2m,
                liveCode: f.current.weather_code,
              };
            } catch {
              return { ...r };
            }
          }),
        );
        if (token === fetchTokenRef.current) {
          setResults(enriched);
        }
      },
      () => setLoading(false),
    );
  }, [query, open, debounce, settings]);

  if (!open) return null;

  const savedNonCurrent = cities.filter((c) => !c.isCurrent);

  return (
    <AnimatePresence>
      <motion.div
        key="city-search"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm"
      >
        <motion.div
          initial={{ y: 24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 24, opacity: 0 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto flex h-full max-w-md flex-col px-4 pb-6 pt-12"
        >
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-2xl font-medium text-white">Cities</h2>
            <button
              type="button"
              aria-label="Close"
              onClick={onClose}
              className="grid h-9 w-9 place-items-center rounded-full bg-white/15 text-white hover:bg-white/25"
            >
              <X className="h-4 w-4" strokeWidth={2.5} />
            </button>
          </div>

          <label className="relative mb-4 flex items-center">
            <Search className="pointer-events-none absolute left-3 h-4 w-4 text-white/55" strokeWidth={2.4} />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              type="search"
              autoComplete="off"
              autoCorrect="off"
              placeholder="Search for a city or airport"
              className="w-full rounded-xl bg-white/15 py-2.5 pl-9 pr-3 text-[15px] text-white placeholder-white/55 outline-none ring-0 focus:bg-white/25"
            />
          </label>

          <div className="flex-1 overflow-y-auto pr-1">
            {query.trim().length >= 2 ? (
              <ResultsList
                rows={results}
                loading={loading}
                settings={settings}
                onAdd={(r) => {
                  onAdd(toCity(r));
                  onClose();
                }}
                onSelect={(r) => {
                  const id = toCity(r).id;
                  const idx = cities.findIndex((c) => c.id === id);
                  if (idx >= 0) {
                    onSelect(idx);
                    onClose();
                  } else {
                    onAdd(toCity(r));
                    onClose();
                  }
                }}
              />
            ) : (
              <SavedAndSuggestions
                cities={cities}
                savedNonCurrent={savedNonCurrent}
                onRemove={onRemove}
                onReorder={onReorder}
                onSelectIndex={(i) => {
                  onSelect(i);
                  onClose();
                }}
                onAddSuggestion={(c) => {
                  onAdd(c);
                  onClose();
                }}
              />
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function ResultsList({
  rows,
  loading,
  settings,
  onAdd,
  onSelect,
}: {
  rows: ResultRow[];
  loading: boolean;
  settings: Settings;
  onAdd: (r: ResultRow) => void;
  onSelect: (r: ResultRow) => void;
}) {
  if (loading && rows.length === 0) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-14 rounded-xl bg-white/8 shimmer" />
        ))}
      </div>
    );
  }
  if (!loading && rows.length === 0) {
    return <p className="px-1 text-sm text-white/55">No results</p>;
  }
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={`${r.id}-${r.latitude}`}>
          <button
            type="button"
            onClick={() => (r.liveTemp !== undefined ? onSelect(r) : onAdd(r))}
            className="flex w-full items-center justify-between rounded-2xl bg-white/12 px-4 py-3 text-left transition-colors hover:bg-white/20"
          >
            <div>
              <div className="text-[15px] font-medium text-white">{r.name}</div>
              <div className="text-[12px] text-white/65">
                {[r.admin1, r.country].filter(Boolean).join(', ')}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {r.liveCode !== undefined ? (
                <WeatherIcon code={r.liveCode} isDay size={20} />
              ) : null}
              {r.liveTemp !== undefined ? (
                <span className="tabular text-xl font-light text-white">
                  {displayTemp(r.liveTemp, settings)}
                </span>
              ) : (
                <span className="text-xs font-medium text-white/55">Add</span>
              )}
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}

function SavedAndSuggestions({
  cities,
  savedNonCurrent,
  onRemove,
  onReorder,
  onSelectIndex,
  onAddSuggestion,
}: {
  cities: City[];
  savedNonCurrent: City[];
  onRemove: (id: string) => void;
  onReorder: (from: number, to: number) => void;
  onSelectIndex: (i: number) => void;
  onAddSuggestion: (c: City) => void;
}) {
  const dragIndexRef = useRef<number | null>(null);
  const [dragHover, setDragHover] = useState<number | null>(null);

  const currentCity = cities.find((c) => c.isCurrent);
  const savedIds = new Set(cities.map((c) => c.id));
  const chips = SUGGESTED_CITIES.filter((c) => !savedIds.has(c.id));

  return (
    <div className="space-y-5">
      {currentCity ? (
        <button
          type="button"
          onClick={() => onSelectIndex(0)}
          className="flex w-full items-center gap-3 rounded-2xl bg-white/12 px-4 py-3 text-left transition-colors hover:bg-white/20"
        >
          <MapPin className="h-4 w-4 text-white" strokeWidth={2.4} />
          <div className="flex-1">
            <div className="text-[15px] font-medium text-white">{currentCity.name}</div>
            <div className="text-[12px] text-white/65">My Location</div>
          </div>
        </button>
      ) : null}

      {chips.length > 0 ? (
        <div>
          <h3 className="mb-2 px-1 text-[11px] font-medium uppercase tracking-wider text-white/55">
            Quick Add
          </h3>
          <div className="flex flex-wrap gap-2">
            {chips.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => onAddSuggestion(c)}
                className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[13px] font-medium text-white transition-colors hover:bg-white/20"
              >
                + {c.name}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {savedNonCurrent.length > 0 ? (
        <div>
          <h3 className="mb-2 px-1 text-[11px] font-medium uppercase tracking-wider text-white/55">
            Saved Cities
          </h3>
          <ul className="space-y-2">
            {savedNonCurrent.map((c, ix) => {
              const overallIndex = cities.findIndex((x) => x.id === c.id);
              const isHovered = dragHover === ix;
              return (
                <li
                  key={c.id}
                  draggable
                  onDragStart={() => (dragIndexRef.current = overallIndex)}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragHover(ix);
                  }}
                  onDragLeave={() => setDragHover(null)}
                  onDrop={() => {
                    if (dragIndexRef.current !== null) {
                      onReorder(dragIndexRef.current, overallIndex);
                    }
                    dragIndexRef.current = null;
                    setDragHover(null);
                  }}
                  className={`group flex items-center gap-2 rounded-2xl bg-white/12 px-3 py-3 ${
                    isHovered ? 'ring-1 ring-white/40' : ''
                  }`}
                >
                  <GripVertical className="h-4 w-4 text-white/40" />
                  <button
                    type="button"
                    onClick={() => onSelectIndex(overallIndex)}
                    className="flex-1 text-left"
                  >
                    <div className="text-[15px] font-medium text-white">{c.name}</div>
                    <div className="text-[12px] text-white/65">
                      {[c.region, c.country].filter(Boolean).join(', ')}
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemove(c.id)}
                    aria-label={`Remove ${c.name}`}
                    className="grid h-8 w-8 place-items-center rounded-full text-white/55 transition hover:bg-red-500/30 hover:text-red-200"
                  >
                    <Trash2 className="h-4 w-4" strokeWidth={2.2} />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
