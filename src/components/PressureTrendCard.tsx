import { Gauge } from 'lucide-react';
import { useMemo } from 'react';
import { Card } from './Card';
import { analyzePressure } from '../lib/pressureTrend';
import { displayPressure } from '../lib/display';
import type { WeatherData } from '../types';

interface Props {
  data: WeatherData;
  index?: number;
}

export function PressureTrendCard({ data, index }: Props) {
  const trend = useMemo(() => analyzePressure(data), [data]);
  const arrow =
    trend.direction === 'rising'
      ? '↑'
      : trend.direction === 'falling'
        ? '↓'
        : '→';
  const arrowColor =
    trend.direction === 'rising'
      ? '#34d399'
      : trend.direction === 'falling'
        ? '#f87171'
        : 'rgba(255,255,255,0.65)';

  const W = 320;
  const H = 64;
  const pad = { l: 6, r: 6, t: 6, b: 6 };
  const span = trend.max - trend.min || 0.05;
  const xFor = (i: number) =>
    pad.l + (i / Math.max(1, trend.points.length - 1)) * (W - pad.l - pad.r);
  const yFor = (p: number) =>
    pad.t + (1 - (p - trend.min) / span) * (H - pad.t - pad.b);

  const linePath = trend.points
    .map((pt, i) => `${i === 0 ? 'M' : 'L'} ${xFor(i).toFixed(1)} ${yFor(pt.pressure).toFixed(1)}`)
    .join(' ');
  const areaPath =
    `${linePath} L ${xFor(trend.points.length - 1).toFixed(1)} ${(H - pad.b).toFixed(1)} L ${xFor(0).toFixed(1)} ${(H - pad.b).toFixed(1)} Z`;

  return (
    <Card
      title="Pressure"
      icon={Gauge}
      index={index}
      meta={`${trend.rate >= 0 ? '+' : ''}${trend.rate} inHg/3h`}
    >
      <div className="flex items-baseline gap-3">
        <span className="card-value text-white">
          {displayPressure(trend.current)}
        </span>
        <span style={{ color: arrowColor }} className="text-2xl font-light">
          {arrow}
        </span>
        <span className="text-[12px] font-medium uppercase tracking-wider text-white/60">
          {trend.direction}
        </span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 h-12 w-full"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="pt-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(0,212,255,0.32)" />
            <stop offset="100%" stopColor="rgba(0,212,255,0)" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#pt-fill)" />
        <path
          d={linePath}
          fill="none"
          stroke="white"
          strokeWidth={1.4}
          strokeLinecap="round"
        />
      </svg>
      <p className="mt-2 text-[13px] text-white/75">{trend.summary}</p>
    </Card>
  );
}
