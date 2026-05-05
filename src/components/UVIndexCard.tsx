import { Sun } from 'lucide-react';
import { Card } from './Card';
import { formatTime } from '../lib/format';
import type { ForecastResponse } from '../types';

interface Props {
  data: ForecastResponse;
  index?: number;
}

function uvCategory(uv: number) {
  if (uv < 3) return { label: 'Low', color: '#22c55e' };
  if (uv < 6) return { label: 'Moderate', color: '#eab308' };
  if (uv < 8) return { label: 'High', color: '#f97316' };
  if (uv < 11) return { label: 'Very High', color: '#ef4444' };
  return { label: 'Extreme', color: '#a855f7' };
}

function lastSafeHourToday(data: ForecastResponse): string | null {
  const today = data.daily.time[0];
  const max = data.daily.uv_index_max[0] ?? 0;
  if (max < 3) return null;

  // Walk hourly entries for today, find the last one with uv >= 3, +1h gives "until".
  // We only have hourly weather, but UV is on daily; approximate: noon ± window.
  // Use sunset as a sane upper bound when we don't have hourly UV.
  const sunset = data.daily.sunset[0];
  if (!sunset) return null;
  return today ? sunset : null;
}

export function UVIndexCard({ data, index }: Props) {
  const uv = Math.max(0, Math.round(data.current.uv_index ?? 0));
  const cat = uvCategory(uv);
  // Gauge: 11 max
  const ratio = Math.min(1, uv / 11);

  const radius = 64;
  const cx = 70;
  const cy = 72;
  const startAngle = Math.PI; // 180°
  const endAngle = 0; // 0°

  // Needle angle
  const angle = startAngle - ratio * (startAngle - endAngle);
  const needleX = cx + Math.cos(angle) * (radius - 6);
  const needleY = cy - Math.sin(angle) * (radius - 6);

  const cutoff = lastSafeHourToday(data);

  return (
    <Card title="UV Index" icon={Sun} index={index}>
      <div className="flex items-baseline gap-3">
        <span className="tabular text-3xl font-light text-white">{uv}</span>
        <span className="text-[15px] font-medium" style={{ color: cat.color }}>
          {cat.label}
        </span>
      </div>

      <svg viewBox="0 0 140 86" className="mt-3 h-20 w-full">
        <defs>
          <linearGradient id="uv-arc" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#22c55e" />
            <stop offset="35%" stopColor="#eab308" />
            <stop offset="60%" stopColor="#f97316" />
            <stop offset="80%" stopColor="#ef4444" />
            <stop offset="100%" stopColor="#a855f7" />
          </linearGradient>
        </defs>
        <path
          d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
          fill="none"
          stroke="rgba(255,255,255,0.15)"
          strokeWidth="6"
          strokeLinecap="round"
        />
        <path
          d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
          fill="none"
          stroke="url(#uv-arc)"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={Math.PI * radius}
          strokeDashoffset={Math.PI * radius * (1 - ratio)}
        />
        <line
          x1={cx}
          y1={cy}
          x2={needleX}
          y2={needleY}
          stroke="white"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <circle cx={cx} cy={cy} r="4" fill="white" />
      </svg>

      {cutoff ? (
        <p className="mt-1 text-[13px] text-white/75">
          Use sun protection until {formatTime(cutoff, data.timezone)}.
        </p>
      ) : (
        <p className="mt-1 text-[13px] text-white/75">Low risk today.</p>
      )}
    </Card>
  );
}
