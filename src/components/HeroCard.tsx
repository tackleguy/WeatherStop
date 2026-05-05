import { motion } from 'framer-motion';
import { describe } from '../lib/weatherCodes';
import { iconFor } from '../constants/weatherIcons';
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
  if (name.includes(region) || region.includes(name)) return false;
  return true;
}

export function HeroCard({ city, data }: Props) {
  const info = describe(data.current.weather_code);
  const isDay = data.current.is_day === 1;
  const today = {
    high: data.daily.temperature_2m_max[0],
    low: data.daily.temperature_2m_min[0],
  };

  let subtitle: string | null = null;
  if (city.isCurrent) subtitle = 'My Location';
  else if (shouldShowRegion(city)) subtitle = city.region!;

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-col items-center pt-6 pb-2 text-center"
    >
      <h1 className="text-[34px] font-light leading-tight text-white">
        {city.name}
      </h1>
      {subtitle ? (
        <div
          className={`mt-0.5 text-[13px] ${
            city.isCurrent ? 'font-medium text-white/80' : 'text-white/65'
          }`}
        >
          {subtitle}
        </div>
      ) : null}

      <div className="tabular mt-1 text-[112px] font-extralight leading-none tracking-[-0.04em] text-white">
        {formatTemp(data.current.temperature_2m, { withDegree: false })}
        <span className="font-extralight text-white/85">°</span>
      </div>

      <div className="mt-1 flex items-center gap-2 text-lg font-medium text-white/90">
        <span className="text-2xl leading-none">{iconFor(data.current.weather_code, isDay)}</span>
        <span>{info.label}</span>
      </div>

      <div className="tabular mt-1 text-[15px] font-medium text-white/80">
        H:{formatTemp(today.high)}  L:{formatTemp(today.low)}
      </div>
    </motion.section>
  );
}
