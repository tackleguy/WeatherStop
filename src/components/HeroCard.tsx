import { motion } from 'framer-motion';
import { HeroScene } from './HeroScene';
import { WeatherIcon } from '../lib/weatherIcons';
import { displayTemp } from '../lib/display';
import type { Settings, WeatherData } from '../types';

interface Props {
  data: WeatherData;
  settings: Settings;
  isCurrent?: boolean;
}

function shouldShowRegion(name: string, region: string): boolean {
  if (!region) return false;
  const n = name.toLowerCase();
  const r = region.toLowerCase();
  if (n === r) return false;
  if (n.includes(r)) return false;
  return true;
}

export function HeroCard({ data, settings, isCurrent }: Props) {
  const { current, today, location } = data;

  let subtitle: string | null = null;
  if (isCurrent) subtitle = 'My Location';
  else if (shouldShowRegion(location.name, location.region))
    subtitle = location.region;

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      className="text-center pt-4 pb-8"
    >
      <HeroScene code={current.code} isDay={current.isDay} />

      <h1 className="hero-city mt-2 text-white">{location.name}</h1>

      {subtitle ? (
        <p className="mt-1 text-[12px] font-semibold uppercase tracking-[0.16em] text-white/55">
          {subtitle}
        </p>
      ) : null}

      <div className="hero-temp mt-6 text-white">
        {displayTemp(current.temp, settings, { withDegree: false })}°
      </div>

      <div className="mt-4 flex items-center justify-center gap-2.5">
        <WeatherIcon
          code={current.code}
          isDay={current.isDay}
          size={22}
          className="opacity-90"
        />
        <p className="hero-condition">{current.conditionLabel}</p>
      </div>

      <p className="tabular mt-2 text-[13px] font-medium text-white/70">
        H {displayTemp(today.high, settings)}{' '}
        <span className="text-white/30 mx-1">·</span> L{' '}
        {displayTemp(today.low, settings)}
      </p>
    </motion.section>
  );
}
