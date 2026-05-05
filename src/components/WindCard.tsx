import { Wind } from 'lucide-react';
import { Card } from './Card';
import { formatWindDir, formatWindSpeed } from '../lib/format';
import type { ForecastResponse, Settings } from '../types';

interface Props {
  data: ForecastResponse;
  settings: Settings;
  index?: number;
}

export function WindCard({ data, settings, index }: Props) {
  const speed = data.current.wind_speed_10m;
  const dir = data.current.wind_direction_10m;
  const gusts = data.current.wind_gusts_10m;

  const cx = 60;
  const cy = 60;
  const radius = 48;

  // SVG: 0° = north (up). The wind direction is "from", so the needle points away.
  const radians = ((dir - 90) * Math.PI) / 180;
  const tipX = cx + Math.cos(radians) * (radius - 6);
  const tipY = cy + Math.sin(radians) * (radius - 6);
  const tailX = cx - Math.cos(radians) * (radius - 18);
  const tailY = cy - Math.sin(radians) * (radius - 18);

  return (
    <Card title="Wind" icon={Wind} index={index}>
      <div className="flex items-center gap-4">
        <svg viewBox="0 0 120 120" className="h-28 w-28 shrink-0">
          <circle cx={cx} cy={cy} r={radius} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="1" />
          <circle cx={cx} cy={cy} r={radius - 10} fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth="1" />
          {[
            { label: 'N', angle: -90 },
            { label: 'E', angle: 0 },
            { label: 'S', angle: 90 },
            { label: 'W', angle: 180 },
          ].map((m) => {
            const r = (m.angle * Math.PI) / 180;
            const x = cx + Math.cos(r) * (radius + 6);
            const y = cy + Math.sin(r) * (radius + 6);
            return (
              <text
                key={m.label}
                x={x}
                y={y + 3}
                textAnchor="middle"
                fontSize="9"
                fill="rgba(255,255,255,0.65)"
                fontWeight={600}
              >
                {m.label}
              </text>
            );
          })}
          <line
            x1={tailX}
            y1={tailY}
            x2={tipX}
            y2={tipY}
            stroke="white"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <polygon
            points={`${tipX},${tipY} ${tipX - 5},${tipY - 5} ${tipX + 5},${tipY - 5}`}
            transform={`rotate(${dir} ${tipX} ${tipY})`}
            fill="white"
          />
          <circle cx={cx} cy={cy} r="3.5" fill="white" />
        </svg>
        <div className="flex flex-col">
          <div className="tabular text-3xl font-light text-white">
            {formatWindSpeed(speed, settings.wind)}
          </div>
          <div className="text-[13px] font-medium uppercase tracking-wide text-white/65">
            From {formatWindDir(dir)}
          </div>
          <div className="mt-2 text-[13px] text-white/75">
            Gusts {formatWindSpeed(gusts, settings.wind)}
          </div>
        </div>
      </div>
    </Card>
  );
}
