import { Waves } from 'lucide-react';
import { Card } from './Card';
import type { TideEvent, TideStation } from '../lib/noaaTides';

interface Props {
  station: TideStation;
  events: TideEvent[];
  loading?: boolean;
  index?: number;
}

function formatTideTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function TideCard({ station, events, loading, index }: Props) {
  const next = events[0];

  // SVG tide curve: connect heights with a smooth path so the high/low
  // pattern is visible at a glance.
  const W = 320;
  const H = 80;
  const pts = events.slice(0, 6);
  const heights = pts.map((e) => e.height);
  const minH = Math.min(...heights, 0);
  const maxH = Math.max(...heights, 1);
  const span = Math.max(0.5, maxH - minH);

  const xFor = (i: number) =>
    8 + (i / Math.max(1, pts.length - 1)) * (W - 16);
  const yFor = (h: number) =>
    8 + (1 - (h - minH) / span) * (H - 24);

  const linePath = pts
    .map(
      (p, i) => `${i === 0 ? 'M' : 'L'} ${xFor(i).toFixed(1)} ${yFor(p.height).toFixed(1)}`,
    )
    .join(' ');
  const areaPath = `${linePath} L ${xFor(pts.length - 1).toFixed(1)} ${(H - 16).toFixed(1)} L ${xFor(0).toFixed(1)} ${(H - 16).toFixed(1)} Z`;

  return (
    <Card
      title="Tides"
      icon={Waves}
      index={index}
      meta={`${station.name}, ${station.state}`}
    >
      {loading && events.length === 0 ? (
        <div className="text-[13px] text-white/55">Loading tides…</div>
      ) : events.length === 0 ? (
        <div className="text-[13px] text-white/55">
          No tide data near this location.
        </div>
      ) : (
        <>
          <div className="flex items-baseline gap-3">
            <span className="card-value text-white">{next.height.toFixed(1)} ft</span>
            <span className="text-[14px] font-medium uppercase tracking-wider"
                  style={{ color: next.type === 'high' ? '#7dd3fc' : '#fb923c' }}>
              Next {next.type}
            </span>
          </div>
          <div className="text-[12px] text-white/65">
            {formatTideTime(next.time)}
          </div>

          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="mt-3 h-16 w-full"
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id="tide-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgba(125,211,252,0.32)" />
                <stop offset="100%" stopColor="rgba(125,211,252,0)" />
              </linearGradient>
            </defs>
            <path d={areaPath} fill="url(#tide-fill)" />
            <path
              d={linePath}
              fill="none"
              stroke="white"
              strokeWidth={1.4}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {pts.map((p, i) => (
              <circle
                key={i}
                cx={xFor(i)}
                cy={yFor(p.height)}
                r={3.2}
                fill={p.type === 'high' ? '#7dd3fc' : '#fb923c'}
                stroke="white"
                strokeWidth={1}
              />
            ))}
          </svg>

          <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-white/70 sm:grid-cols-3">
            {pts.slice(1, 4).map((e, i) => (
              <div key={i} className="rounded-md bg-white/[0.04] px-2 py-1">
                <div className="font-semibold uppercase tracking-wider"
                     style={{ color: e.type === 'high' ? '#7dd3fc' : '#fb923c' }}>
                  {e.type}
                </div>
                <div className="tabular text-white/85">{formatTideTime(e.time)}</div>
                <div className="tabular text-white/55">{e.height.toFixed(1)} ft</div>
              </div>
            ))}
          </div>
        </>
      )}
    </Card>
  );
}
