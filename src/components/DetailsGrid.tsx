import { Droplets, Eye, Gauge, Thermometer } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { motion } from 'framer-motion';
import { displayPressure, displayTemp, displayVisibility } from '../lib/display';
import type { Settings, WeatherData } from '../types';

interface Props {
  data: WeatherData;
  settings: Settings;
  index?: number;
}

interface Cell {
  title: string;
  icon: LucideIcon;
  value: string;
  sub: string;
}

function feelsSub(actual: number, feels: number): string {
  const diff = Math.round(feels - actual);
  if (Math.abs(diff) < 1) return 'Same as actual';
  return diff > 0 ? `${diff}° warmer` : `${Math.abs(diff)}° cooler`;
}

export function DetailsGrid({ data, settings, index }: Props) {
  const c = data.current;

  const cells: Cell[] = [
    {
      title: 'Feels Like',
      icon: Thermometer,
      value: displayTemp(c.feelsLike, settings),
      sub: feelsSub(c.temp, c.feelsLike),
    },
    {
      title: 'Humidity',
      icon: Droplets,
      value: `${Math.round(c.humidity)}%`,
      sub: `Dew pt ${displayTemp(c.dewPoint, settings)}`,
    },
    {
      title: 'Visibility',
      icon: Eye,
      value: displayVisibility(c.visibility, settings),
      sub: c.visibility >= 9.5 ? 'Clear' : c.visibility >= 5 ? 'Reduced' : 'Poor',
    },
    {
      title: 'Pressure',
      icon: Gauge,
      value: displayPressure(c.pressure),
      sub: c.pressure >= 30.1 ? 'High' : c.pressure <= 29.7 ? 'Low' : 'Steady',
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.45,
        delay: 0.06 + (index ?? 0) * 0.06,
        ease: [0.4, 0, 0.2, 1],
      }}
      className="panel grid grid-cols-2 sm:grid-cols-4 sm:divide-x sm:divide-white/[0.06]"
    >
      {cells.map((cell, i) => {
        const Icon = cell.icon;
        return (
          <div
            key={cell.title}
            className={`flex flex-col items-start gap-2 px-4 py-4 ${
              // Bottom dividers for the 2x2 mobile fallback
              i < 2 ? 'border-b border-white/[0.06] sm:border-b-0' : ''
            }`}
          >
            <div className="flex items-center gap-1.5">
              <Icon
                className="h-3.5 w-3.5"
                strokeWidth={1.6}
                style={{ color: 'var(--accent)' }}
              />
              <span className="card-label">{cell.title}</span>
            </div>
            <div className="card-value text-white">{cell.value}</div>
            <div className="card-sub">{cell.sub}</div>
          </div>
        );
      })}
    </motion.div>
  );
}
