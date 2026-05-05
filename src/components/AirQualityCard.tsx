import { Wind } from 'lucide-react';
import { Card } from './Card';
import type { AirQualityResponse } from '../types';

interface Props {
  data?: AirQualityResponse;
  index?: number;
}

interface AqiCategory {
  label: string;
  color: string;
  description: string;
}

function categorize(aqi: number): AqiCategory {
  if (aqi <= 50) return { label: 'Good', color: '#22c55e', description: 'Air quality is satisfactory.' };
  if (aqi <= 100)
    return {
      label: 'Moderate',
      color: '#eab308',
      description: 'Acceptable for most.',
    };
  if (aqi <= 150)
    return {
      label: 'Unhealthy for Sensitive',
      color: '#f97316',
      description: 'Sensitive groups should limit exertion.',
    };
  if (aqi <= 200)
    return { label: 'Unhealthy', color: '#ef4444', description: 'Avoid prolonged exertion outdoors.' };
  if (aqi <= 300)
    return { label: 'Very Unhealthy', color: '#a855f7', description: 'Health warnings of emergency conditions.' };
  return { label: 'Hazardous', color: '#7f1d1d', description: 'Health alert: everyone may experience effects.' };
}

export function AirQualityCard({ data, index }: Props) {
  if (!data) {
    return (
      <Card title="Air Quality" icon={Wind} index={index}>
        <p className="text-sm text-white/60">Air quality data unavailable.</p>
      </Card>
    );
  }

  const aqi = Math.round(data.current.us_aqi ?? 0);
  const cat = categorize(aqi);
  const pct = Math.min(100, Math.max(0, (aqi / 300) * 100));

  return (
    <Card title="Air Quality" icon={Wind} index={index}>
      <div className="flex items-end justify-between">
        <div className="flex items-baseline gap-3">
          <span
            className="tabular text-5xl font-light"
            style={{ color: cat.color }}
          >
            {aqi}
          </span>
          <span className="text-[15px] font-medium text-white/85">{cat.label}</span>
        </div>
      </div>

      <div className="mt-4 h-1.5 rounded-full bg-gradient-to-r from-emerald-400 via-yellow-400 via-orange-400 via-red-500 to-purple-500">
        <div
          className="relative h-full"
          style={{ width: `${pct}%` }}
          aria-hidden
        >
          <div
            className="absolute right-0 top-1/2 h-3 w-3 -translate-y-1/2 translate-x-1/2 rounded-full border-2 border-white bg-white"
            style={{ boxShadow: '0 0 0 2px rgba(0,0,0,0.25)' }}
          />
        </div>
      </div>

      <p className="mt-3 text-[13px] text-white/75">{cat.description}</p>
    </Card>
  );
}
