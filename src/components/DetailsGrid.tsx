import { Droplets, Eye, Gauge, Thermometer } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Card } from './Card';
import {
  formatPressure,
  formatTemp,
  formatVisibility,
} from '../lib/format';
import type { ForecastResponse, Settings } from '../types';

interface Props {
  data: ForecastResponse;
  settings: Settings;
  index?: number;
}

interface Tile {
  title: string;
  icon: LucideIcon;
  value: string;
  hint?: string;
}

function dewPoint(tempC: number, rh: number) {
  // Magnus approximation
  const a = 17.625;
  const b = 243.04;
  const alpha = (a * tempC) / (b + tempC) + Math.log(rh / 100);
  return (b * alpha) / (a - alpha);
}

export function DetailsGrid({ data, settings, index }: Props) {
  const c = data.current;

  let dewLabel = '';
  if (c.relative_humidity_2m > 0) {
    const tempC =
      settings.temp === 'celsius'
        ? c.temperature_2m
        : ((c.temperature_2m - 32) * 5) / 9;
    const dpC = dewPoint(tempC, c.relative_humidity_2m);
    const dpDisplay =
      settings.temp === 'celsius' ? dpC : (dpC * 9) / 5 + 32;
    dewLabel = `Dew ${formatTemp(dpDisplay)}`;
  }

  const tiles: Tile[] = [
    {
      title: 'Feels Like',
      icon: Thermometer,
      value: formatTemp(c.apparent_temperature),
    },
    {
      title: 'Humidity',
      icon: Droplets,
      value: `${Math.round(c.relative_humidity_2m)}%`,
      hint: dewLabel,
    },
    {
      title: 'Visibility',
      icon: Eye,
      value: formatVisibility(c.visibility, settings.distance),
    },
    {
      title: 'Pressure',
      icon: Gauge,
      value: formatPressure(c.pressure_msl),
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3">
      {tiles.map((tile, i) => (
        <Card
          key={tile.title}
          title={tile.title}
          icon={tile.icon}
          index={(index ?? 0) + i * 0.2}
        >
          <div className="tabular text-3xl font-light text-white">{tile.value}</div>
          {tile.hint ? (
            <div className="mt-1 text-[12px] text-white/65">{tile.hint}</div>
          ) : null}
        </Card>
      ))}
    </div>
  );
}
