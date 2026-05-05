import { motion } from 'framer-motion';
import { WeatherIcon } from '../lib/weatherIcons';
import { displayTemp } from '../lib/display';
import type { Settings, WeatherData } from '../types';

interface Props {
  data: WeatherData;
  settings: Settings;
  isCurrent?: boolean;
}

function shouldShowRegion(
  name: string,
  region: string,
): boolean {
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
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="text-center pt-10 pb-8"
    >
      <h1 className="text-3xl font-light tracking-tight text-white">
        {location.name}
      </h1>
      {subtitle ? (
        <p className="mt-1 text-sm font-medium tracking-wide text-white/60">
          {subtitle}
        </p>
      ) : null}

      <div className="tabular mt-6 text-[7rem] md:text-[9rem] font-thin leading-none tracking-tighter text-white">
        {displayTemp(current.temp, settings, { withDegree: false })}°
      </div>

      <div className="mt-3 flex items-center justify-center gap-2">
        <WeatherIcon code={current.code} isDay={current.isDay} size={28} />
        <p className="text-xl font-medium text-white/90">
          {current.conditionLabel}
        </p>
      </div>

      <p className="tabular mt-1 text-sm font-medium tracking-wide text-white/70">
        H: {displayTemp(today.high, settings)} · L:{' '}
        {displayTemp(today.low, settings)}
      </p>
    </motion.section>
  );
}
