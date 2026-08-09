// Multi-model forecast compare powered by Open-Meteo.

import { useEffect, useMemo, useState } from 'react';
import { MapPin, RefreshCw } from 'lucide-react';
import {
  ModelCompareChart,
  ModelValuesTable,
} from '../components/models/ModelCompareChart';
import { ModelPicker } from '../components/models/ModelPicker';
import { SearchBar } from '../components/radar/SearchBar';
import {
  MODEL_VARIABLES,
  WEATHER_MODELS,
  defaultModelIds,
  getModel,
  modelCoversLocation,
  type ModelId,
  type ModelVariable,
} from '../constants/models';
import type { ModelStatus } from '../lib/openMeteoModels';
import { INITIAL_SEED } from '../constants/cities';
import { useCities } from '../hooks/useCities';
import { useModelForecasts } from '../hooks/useModelForecasts';

interface Loc {
  name: string;
  lat: number;
  lon: number;
}

const MAX_MODELS = 8;

function coveringOnly(ids: ModelId[], lat: number, lon: number): ModelId[] {
  return ids.filter((id) => {
    const m = getModel(id);
    return m ? modelCoversLocation(m, lat, lon) : false;
  });
}

export function ModelsView() {
  const { cities } = useCities();
  const [loc, setLoc] = useState<Loc>(() => {
    try {
      const raw = localStorage.getItem('cities-v1');
      if (raw) {
        const parsed = JSON.parse(raw) as Array<{
          name: string;
          latitude: number;
          longitude: number;
          isCurrent?: boolean;
        }>;
        const current =
          parsed.find((c) => c.isCurrent) ?? parsed[0] ?? null;
        if (current) {
          return {
            name: current.name,
            lat: current.latitude,
            lon: current.longitude,
          };
        }
      }
    } catch {
      // ignore
    }
    const seed = INITIAL_SEED[0];
    return {
      name: seed?.name ?? 'Kansas City',
      lat: seed?.latitude ?? 39.1,
      lon: seed?.longitude ?? -94.6,
    };
  });
  const [modelIds, setModelIds] = useState<ModelId[]>(() =>
    coveringOnly(defaultModelIds(), loc.lat, loc.lon),
  );
  const [variable, setVariable] = useState<ModelVariable>('temperature_2m');
  const [frameIdx, setFrameIdx] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);

  const { series, loading, refresh } = useModelForecasts(
    loc.lat,
    loc.lon,
    modelIds,
  );

  // Reset scrubber when location / models change.
  useEffect(() => {
    setFrameIdx(0);
  }, [loc.lat, loc.lon, modelIds]);

  // A regional model selected for the previous location is dead weight here,
  // so swap it out for defaults that actually reach the new one.
  useEffect(() => {
    setModelIds((prev) => {
      const kept = coveringOnly(prev, loc.lat, loc.lon);
      if (kept.length === prev.length) return prev;
      const fill = coveringOnly(defaultModelIds(), loc.lat, loc.lon).filter(
        (id) => !kept.includes(id),
      );
      return [...kept, ...fill].slice(0, MAX_MODELS);
    });
  }, [loc.lat, loc.lon]);

  const statusById = useMemo(() => {
    const out: Partial<Record<ModelId, ModelStatus>> = {};
    for (const s of series) out[s.modelId] = s.status;
    return out;
  }, [series]);

  const withData = series.filter((s) => s.status === 'ok').length;

  return (
    <div
      className="absolute inset-0 flex flex-col overflow-hidden"
      style={{ background: 'var(--surface-0)' }}
    >
      <div className="h-3 shrink-0" aria-hidden />

      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-3 overflow-hidden px-3 pb-4 sm:px-4">
        <header className="flex flex-wrap items-center gap-2">
          <div
            className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-[var(--line-default)] px-3 py-2 backdrop-blur-[28px]"
            style={{ background: 'var(--glass-hi)' }}
          >
            <MapPin
              className="h-4 w-4 shrink-0"
              style={{ color: 'var(--accent)' }}
              strokeWidth={1.8}
            />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[14px] font-semibold text-[var(--ink-1)]">
                {loc.name}
              </div>
              <div className="tabular text-[11px] text-[var(--ink-4)]">
                {loc.lat.toFixed(3)}, {loc.lon.toFixed(3)}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSearchOpen((v) => !v)}
              className="rounded-lg px-2.5 py-1 text-[12px] font-medium text-[var(--ink-2)] hover:bg-white/5"
            >
              {searchOpen ? 'Close' : 'Change'}
            </button>
            <button
              type="button"
              onClick={() => refresh()}
              aria-label="Refresh models"
              className="rounded-lg p-1.5 text-[var(--ink-3)] hover:bg-white/5 hover:text-[var(--ink-1)]"
            >
              <RefreshCw
                className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}
                strokeWidth={1.8}
              />
            </button>
          </div>

          {cities.length > 0 ? (
            <div className="flex max-w-full gap-1 overflow-x-auto no-scrollbar">
              {cities.slice(0, 8).map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() =>
                    setLoc({
                      name: c.name,
                      lat: c.latitude,
                      lon: c.longitude,
                    })
                  }
                  className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-medium transition-colors ${
                    c.latitude === loc.lat && c.longitude === loc.lon
                      ? 'bg-[var(--accent)] text-black'
                      : 'border border-[var(--line-default)] text-[var(--ink-3)] hover:text-[var(--ink-1)]'
                  }`}
                  style={
                    c.latitude === loc.lat && c.longitude === loc.lon
                      ? undefined
                      : { background: 'var(--glass)' }
                  }
                >
                  {c.name}
                </button>
              ))}
            </div>
          ) : null}
        </header>

        {searchOpen ? (
          <div className="max-w-md">
            <SearchBar
              onPick={(p) => {
                setLoc({ name: p.label, lat: p.lat, lon: p.lon });
                setSearchOpen(false);
              }}
            />
          </div>
        ) : null}

        <div
          className="flex flex-wrap items-center gap-1.5 rounded-xl border border-[var(--line-default)] px-2 py-2 backdrop-blur-[28px]"
          style={{ background: 'var(--glass-hi)' }}
        >
          <span className="px-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--ink-4)]">
            Variable
          </span>
          {MODEL_VARIABLES.map((v) => {
            const active = variable === v.id;
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => setVariable(v.id)}
                className={`rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition-all sm:text-[12px] ${
                  active
                    ? 'text-black'
                    : 'text-[var(--ink-3)] hover:bg-white/5 hover:text-[var(--ink-1)]'
                }`}
                style={
                  active
                    ? {
                        background: 'var(--cool)',
                        boxShadow: '0 0 10px var(--cool-glow)',
                      }
                    : undefined
                }
              >
                <span className="sm:hidden">{v.short}</span>
                <span className="hidden sm:inline">{v.label}</span>
              </button>
            );
          })}
        </div>

        <div className="grid min-h-0 flex-1 gap-3 overflow-hidden lg:grid-cols-[260px_1fr]">
          <ModelPicker
            selected={modelIds}
            onChange={setModelIds}
            max={MAX_MODELS}
            lat={loc.lat}
            lon={loc.lon}
            statusById={statusById}
          />

          <div className="flex min-h-0 flex-col gap-3 overflow-y-auto">
            <ModelCompareChart
              series={series}
              modelIds={modelIds}
              variable={variable}
              frameIdx={frameIdx}
              onFrameChange={setFrameIdx}
            />
            <ModelValuesTable
              series={series}
              modelIds={modelIds}
              variable={variable}
              frameIdx={frameIdx}
            />
            <p className="px-1 pb-2 text-[10px] text-[var(--ink-4)]">
              Data from Open-Meteo · {withData} of {modelIds.length} selected
              models reporting. All {WEATHER_MODELS.length} models are
              selectable; limited-area models only run over their own domain,
              so the picker marks the ones that reach this location.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
