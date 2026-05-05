import { MapPin } from 'lucide-react';
import { describeCondition } from '../lib/describeCondition';
import { displayTemp } from '../lib/display';
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
  const { data } = useWeather(city);
  const cityTime = useLocalTime(
    city.timezone ?? data?.data.location.timezone,
  );

  const w = data?.data;

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
          <div className="tabular mt-0.5 text-xs text-white/60">
            {city.isCurrent ? 'My Location' : cityTime}
          </div>
          {w ? (
            <div className="mt-2 truncate text-xs text-white/75">
              {describeCondition(w.current.temp, w.current.code)}
            </div>
          ) : null}
        </div>

        {w ? (
          <div className="flex shrink-0 flex-col items-end">
            <WeatherIcon
              code={w.current.code}
              isDay={w.current.isDay}
              size={20}
              className="mb-1"
            />
            <div className="tabular text-3xl font-thin leading-none text-white">
              {displayTemp(w.current.temp, settings, { withDegree: false })}°
            </div>
            <div className="tabular mt-1.5 text-[10px] text-white/60">
              H:{displayTemp(w.today.high, settings)} L:
              {displayTemp(w.today.low, settings)}
            </div>
          </div>
        ) : (
          <div className="h-12 w-16 rounded-lg shimmer" />
        )}
      </div>
    </button>
  );
}
