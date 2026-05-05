import { motion } from 'framer-motion';
import { describe } from '../lib/weatherCodes';
import { WeatherIcon } from '../lib/weatherIcons';
import { formatTemp } from '../lib/format';
import type { City, ForecastResponse } from '../types';

interface Props {
  city: City;
  data: ForecastResponse;
}

function shouldShowRegion(city: City): boolean {
  if (!city.region) return false;
  const name = city.name.toLowerCase();
  const region = city.region.toLowerCase();
  if (region === name) return false;
  if (name.includes(region)) return false;
  return true;
}

export function HeroCard({ city, data }: Props) {
  const info = describe(data.current.weather_code);
  const isDay = data.current.is_day === 1;
  const high = data.daily.temperature_2m_max[0];
  const low = data.daily.temperature_2m_min[0];

  let subtitle: string | null = null;
  if (city.isCurrent) subtitle = 'My Location';
  else if (shouldShowRegion(city)) subtitle = city.region!;

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="text-center pt-10 pb-8"
    >
      <h1 className="text-3xl font-light tracking-tight text-white">
        {city.name}
      </h1>
      {subtitle ? (
        <p className="mt-1 text-sm font-medium tracking-wide text-white/60">
          {subtitle}
        </p>
      ) : null}

      <div className="tabular mt-6 text-[7rem] md:text-[9rem] font-thin leading-none tracking-tighter text-white">
        {formatTemp(data.current.temperature_2m, { withDegree: false })}°
      </div>

      <div className="mt-3 flex items-center justify-center gap-2">
        <WeatherIcon code={data.current.weather_code} isDay={isDay} size={28} />
        <p className="text-xl font-medium text-white/90">{info.label}</p>
      </div>

      <p className="tabular mt-1 text-sm font-medium tracking-wide text-white/70">
        H: {formatTemp(high)}  ·  L: {formatTemp(low)}
      </p>
    </motion.section>
  );
}
