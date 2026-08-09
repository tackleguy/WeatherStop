import { useMemo } from 'react';
import {
  MODEL_COLORS,
  MODEL_VARIABLES,
  getModel,
  type ModelId,
  type ModelVariable,
} from '../../constants/models';
import type { ModelHourlySeries } from '../../lib/openMeteoModels';

interface Props {
  series: ModelHourlySeries[];
  modelIds: ModelId[];
  variable: ModelVariable;
  frameIdx: number;
  onFrameChange: (i: number) => void;
}

function alignTimes(
  series: ModelHourlySeries[],
  variable: ModelVariable,
): string[] {
  const set = new Set<string>();
  for (const s of series) {
    if (!s.available.includes(variable)) continue;
    for (const t of s.time) set.add(t);
  }
  return Array.from(set).sort();
}

function valueAt(
  s: ModelHourlySeries,
  variable: ModelVariable,
  iso: string,
): number | null {
  const i = s.time.indexOf(iso);
  if (i < 0) return null;
  const arr = s.values[variable];
  if (!arr) return null;
  const v = arr[i];
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

export interface SeriesState {
  ok: boolean;
  label: string;
}

/** Why a model is (or is not) drawing a line for the current variable. */
export function describeSeries(
  s: ModelHourlySeries | undefined,
  variable: ModelVariable,
): SeriesState {
  if (!s) return { ok: false, label: 'Loading…' };
  switch (s.status) {
    case 'out-of-domain':
      return { ok: false, label: s.error ?? 'Outside model domain' };
    case 'no-upstream-data':
      return { ok: false, label: 'Unavailable upstream' };
    case 'error':
      return { ok: false, label: s.error ?? 'Failed to load' };
    default:
      break;
  }
  if (!s.available.includes(variable)) {
    const meta = MODEL_VARIABLES.find((v) => v.id === variable);
    return { ok: false, label: `No ${meta?.short ?? variable} from this model` };
  }
  const hours = s.time.length;
  return { ok: true, label: `${Math.round(hours / 24)}d of data` };
}

export function ModelCompareChart({
  series,
  modelIds,
  variable,
  frameIdx,
  onFrameChange,
}: Props) {
  const times = useMemo(() => alignTimes(series, variable), [series, variable]);
  const meta = MODEL_VARIABLES.find((v) => v.id === variable)!;
  const safeIdx = Math.min(Math.max(frameIdx, 0), Math.max(times.length - 1, 0));

  const { paths, ymin, ymax } = useMemo(() => {
    let min = Infinity;
    let max = -Infinity;
    const pts: Array<{
      id: ModelId;
      color: string;
      points: Array<{ x: number; y: number; v: number }>;
    }> = [];

    modelIds.forEach((id, mi) => {
      const s = series.find((x) => x.modelId === id);
      if (!s || s.status !== 'ok' || !s.available.includes(variable)) return;
      const points: Array<{ x: number; y: number; v: number }> = [];
      times.forEach((t, ti) => {
        const v = valueAt(s, variable, t);
        if (v === null) return;
        min = Math.min(min, v);
        max = Math.max(max, v);
        points.push({ x: ti, y: v, v });
      });
      if (points.length)
        pts.push({ id, color: MODEL_COLORS[mi % MODEL_COLORS.length], points });
    });

    if (!Number.isFinite(min)) {
      min = 0;
      max = 1;
    }
    if (min === max) {
      min -= 1;
      max += 1;
    }
    const pad = (max - min) * 0.08;
    return { paths: pts, ymin: min - pad, ymax: max + pad };
  }, [series, modelIds, variable, times]);

  const W = 720;
  const H = 280;
  const padL = 44;
  const padR = 12;
  const padT = 16;
  const padB = 28;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  function xScale(i: number) {
    return padL + (times.length <= 1 ? 0 : (i / (times.length - 1)) * innerW);
  }
  function yScale(v: number) {
    return padT + ((ymax - v) / (ymax - ymin)) * innerH;
  }

  const cursorX = times.length ? xScale(safeIdx) : padL;
  const currentTime = times[safeIdx];

  // Distinguish "nothing selected has this variable" from "nothing has data".
  const anyLoaded = modelIds.some((id) =>
    series.some((s) => s.modelId === id && s.status === 'ok'),
  );
  const emptyMessage = anyLoaded
    ? `None of the selected models publish ${meta.label}. Try another variable.`
    : 'No selected model has data for this location — use “Best here”.';

  return (
    <div
      className="rounded-xl border border-[var(--line-default)] p-3 backdrop-blur-[28px]"
      style={{ background: 'var(--glass-hi)' }}
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[13px] font-semibold text-[var(--ink-1)]">
          {meta.label}
          <span className="ml-2 text-[11px] font-normal text-[var(--ink-4)]">
            {meta.unit}
          </span>
        </h2>
        <div className="flex flex-wrap gap-2">
          {modelIds.map((id, i) => {
            const m = getModel(id);
            const s = series.find((x) => x.modelId === id);
            const state = describeSeries(s, variable);
            return (
              <span
                key={id}
                title={state.label}
                className="inline-flex items-center gap-1.5 text-[11px] text-[var(--ink-2)]"
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{
                    background: state.ok
                      ? MODEL_COLORS[i % MODEL_COLORS.length]
                      : '#6b7280',
                  }}
                />
                {m?.short ?? id}
                {state.ok ? null : (
                  <span className="text-[var(--ink-4)]">(n/a)</span>
                )}
              </span>
            );
          })}
        </div>
      </div>

      <div className="w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full min-w-[480px]"
          role="img"
          aria-label={`${meta.label} model comparison`}
        >
          {[0, 0.25, 0.5, 0.75, 1].map((t) => {
            const y = padT + t * innerH;
            const v = ymax - t * (ymax - ymin);
            return (
              <g key={t}>
                <line
                  x1={padL}
                  x2={W - padR}
                  y1={y}
                  y2={y}
                  stroke="rgba(255,255,255,0.06)"
                />
                <text
                  x={padL - 6}
                  y={y + 3}
                  textAnchor="end"
                  fill="rgba(244,246,251,0.4)"
                  fontSize="10"
                >
                  {Math.round(v * 10) / 10}
                </text>
              </g>
            );
          })}

          {paths.map((p) => {
            const d = p.points
              .map(
                (pt, i) => `${i === 0 ? 'M' : 'L'}${xScale(pt.x)},${yScale(pt.y)}`,
              )
              .join(' ');
            return (
              <path
                key={p.id}
                d={d}
                fill="none"
                stroke={p.color}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            );
          })}

          {times.length > 0 ? (
            <line
              x1={cursorX}
              x2={cursorX}
              y1={padT}
              y2={H - padB}
              stroke="rgba(255,255,255,0.35)"
              strokeDasharray="4 3"
            />
          ) : null}

          {paths.map((p) => {
            const pt = p.points.find((x) => x.x === safeIdx);
            if (!pt) return null;
            return (
              <circle
                key={`${p.id}-dot`}
                cx={xScale(pt.x)}
                cy={yScale(pt.y)}
                r={3.5}
                fill={p.color}
                stroke="#0b1020"
                strokeWidth={1.5}
              />
            );
          })}

          {currentTime ? (
            <text
              x={cursorX}
              y={H - 8}
              textAnchor="middle"
              fill="rgba(244,246,251,0.55)"
              fontSize="10"
            >
              {formatTick(currentTime)}
            </text>
          ) : null}
        </svg>
      </div>

      {times.length > 0 ? (
        <div className="mt-2 flex items-center gap-3">
          <input
            type="range"
            min={0}
            max={times.length - 1}
            value={safeIdx}
            onChange={(e) => onFrameChange(Number(e.target.value))}
            className="w-full accent-[var(--accent)]"
            aria-label="Forecast hour"
          />
          <span className="shrink-0 tabular text-[11px] text-[var(--ink-3)]">
            {formatTick(times[safeIdx])}
          </span>
        </div>
      ) : (
        <p className="mt-2 text-center text-[12px] text-[var(--ink-4)]">
          {emptyMessage}
        </p>
      )}
    </div>
  );
}

function formatTick(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
    });
  } catch {
    return iso;
  }
}

export function ModelValuesTable({
  series,
  modelIds,
  variable,
  frameIdx,
}: {
  series: ModelHourlySeries[];
  modelIds: ModelId[];
  variable: ModelVariable;
  frameIdx: number;
}) {
  const times = alignTimes(series, variable);
  const iso = times[Math.min(frameIdx, Math.max(times.length - 1, 0))];
  const meta = MODEL_VARIABLES.find((v) => v.id === variable)!;

  return (
    <div
      className="overflow-hidden rounded-xl border border-[var(--line-default)] backdrop-blur-[28px]"
      style={{ background: 'var(--glass-hi)' }}
    >
      <table className="w-full text-left text-[12px]">
        <thead>
          <tr className="border-b border-[var(--line-subtle)] text-[10px] uppercase tracking-[0.1em] text-[var(--ink-4)]">
            <th className="px-3 py-2 font-bold">Model</th>
            <th className="px-3 py-2 font-bold">{meta.short}</th>
            <th className="px-3 py-2 font-bold">Status</th>
          </tr>
        </thead>
        <tbody>
          {modelIds.map((id, i) => {
            const m = getModel(id);
            const s = series.find((x) => x.modelId === id);
            const state = describeSeries(s, variable);
            const v = s && iso ? valueAt(s, variable, iso) : null;
            return (
              <tr
                key={id}
                className="border-b border-[var(--line-subtle)] last:border-0"
              >
                <td className="px-3 py-2">
                  <span className="inline-flex items-center gap-2 font-semibold text-[var(--ink-1)]">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{
                        background: state.ok
                          ? MODEL_COLORS[i % MODEL_COLORS.length]
                          : '#6b7280',
                      }}
                    />
                    {m?.label ?? id}
                  </span>
                </td>
                <td className="px-3 py-2 tabular text-[var(--ink-2)]">
                  {v === null ? '—' : `${Math.round(v * 10) / 10} ${meta.unit}`}
                </td>
                <td className="px-3 py-2 text-[var(--ink-4)]">{state.label}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
