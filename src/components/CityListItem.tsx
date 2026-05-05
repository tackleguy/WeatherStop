import { MapPin } from 'lucide-react';
import { describeCondition } from '../lib/describeCondition';
import { formatTemp } from '../lib/format';
import { WeatherIcon } from '../lib/weatherIcons';
import { useLocalTime } from '../hooks/useLocalTime';
import { useWeather } from '../hooks/useWeather';
import type { City, Settings } from '../types';

interface Props {
  city: City;
  active: boolean;
  settings: Settings;
  onClick: () => void;
}

export function CityListItem({ city, active, settings, onClick }: Props) {
  const { data } = useWeather(city, settings);
  const cityTime = useLocalTime(city.timezone ?? data?.forecast.timezone);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-2xl p-4 text-left transition-colors ${
        active
          ? 'bg-white/[0.18] ring-1 ring-white/25'
          : 'bg-white/[0.06] hover:bg-white/[0.12]'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            {city.isCurrent ? (
              <MapPin className="h-3.5 w-3.5 text-white" strokeWidth={2.4} />
            ) : null}
            <span className="truncate font-semibold text-white">
              {city.name}
            </span>
          </div>
          <div className="mt-0.5 text-xs text-white/60 tabular">
            {city.isCurrent ? 'My Location' : cityTime}
          </div>
          {data ? (
            <div className="mt-2 truncate text-xs text-white/75">
              {describeCondition(
                data.forecast.current.temperature_2m,
                settings.temp,
                data.forecast.current.weather_code,
              )}
            </div>
          ) : null}
        </div>

        {data ? (
          <div className="flex shrink-0 flex-col items-end">
            <WeatherIcon
              code={data.forecast.current.weather_code}
              isDay={data.forecast.current.is_day === 1}
              size={20}
              className="mb-1"
            />
            <div className="tabular text-3xl font-thin leading-none text-white">
              {formatTemp(data.forecast.current.temperature_2m, {
                withDegree: false,
              })}
              °
            </div>
            <div className="tabular mt-1.5 text-[10px] text-white/60">
              H:{formatTemp(data.forecast.daily.temperature_2m_max[0])} L:
              {formatTemp(data.forecast.daily.temperature_2m_min[0])}
            </div>
          </div>
        ) : (
          <div className="h-12 w-16 rounded-lg shimmer" />
        )}
      </div>
    </button>
  );
}
