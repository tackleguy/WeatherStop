import { Sunrise } from 'lucide-react';
import { Card } from './Card';
import { durationBetween, formatTime } from '../lib/format';
import type { WeatherData } from '../types';

interface Props {
  data: WeatherData;
  index?: number;
}

export function SunCard({ data, index }: Props) {
  const { sunrise, sunset } = data.today;
  const tz = data.location.timezone;
  const now = Date.now();
  const sr = new Date(sunrise).getTime();
  const ss = new Date(sunset).getTime();
  const progress = Math.min(1, Math.max(0, (now - sr) / Math.max(1, ss - sr)));

  const cx = 80;
  const cy = 70;
  const radius = 60;
  const startAngle = Math.PI;
  const endAngle = 0;
  const angle = startAngle - progress * (startAngle - endAngle);
  const sunX = cx + Math.cos(angle) * radius;
  const sunY = cy - Math.sin(angle) * radius;

  return (
    <Card title="Sunrise" icon={Sunrise} index={index}>
      <div className="tabular text-3xl font-light text-white">
        {formatTime(sunrise, tz)}
      </div>

      <svg viewBox="0 0 160 90" className="mt-2 h-24 w-full">
        <line x1="0" y1={cy} x2="160" y2={cy} stroke="rgba(255,255,255,0.25)" strokeWidth="1" />
        <path
          d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
          fill="none"
          stroke="rgba(255,255,255,0.35)"
          strokeWidth="1.5"
          strokeDasharray="3 4"
        />
        <circle cx={sunX} cy={Math.min(sunY, cy)} r="6" fill="#fde68a" />
        <circle cx={sunX} cy={Math.min(sunY, cy)} r="11" fill="#fde68a" opacity="0.35" />
      </svg>

      <div className="mt-2 flex items-end justify-between text-[13px] text-white/75">
        <span>Sunset {formatTime(sunset, tz)}</span>
        <span>Daylight {durationBetween(sunrise, sunset)}</span>
      </div>
    </Card>
  );
}
