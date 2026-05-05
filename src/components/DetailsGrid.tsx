import { Droplets, Eye, Gauge, Thermometer } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Card } from './Card';
import {
  displayPressure,
  displayTemp,
  displayVisibility,
} from '../lib/display';
import type { Settings, WeatherData } from '../types';

interface Props {
  data: WeatherData;
  settings: Settings;
  index?: number;
}

interface Tile {
  title: string;
  icon: LucideIcon;
  value: string;
  hint?: string;
}

export function DetailsGrid({ data, settings, index }: Props) {
  const c = data.current;

  const tiles: Tile[] = [
    {
      title: 'Feels Like',
      icon: Thermometer,
      value: displayTemp(c.feelsLike, settings),
    },
    {
      title: 'Humidity',
      icon: Droplets,
      value: `${Math.round(c.humidity)}%`,
      hint: `Dew ${displayTemp(c.dewPoint, settings)}`,
    },
    {
      title: 'Visibility',
      icon: Eye,
      value: displayVisibility(c.visibility, settings),
    },
    {
      title: 'Pressure',
      icon: Gauge,
      value: displayPressure(c.pressure),
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
