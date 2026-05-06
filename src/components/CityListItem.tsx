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

interface MiniBar {
  pct: number;
  label: string;
  color: string;
}

function aqiColor(aqi: number): string {
  if (aqi <= 50) return '#22c55e';
  if (aqi <= 100) return '#eab308';
  if (aqi <= 150) return '#f97316';
  if (aqi <= 200) return '#ef4444';
  if (aqi <= 300) return '#a855f7';
  return '#7f1d1d';
}

export function CityListItem({ city, active, settings, onClick }: Props) {
  const { data } = useWeather(city);
  const cityTime = useLocalTime(city.timezone ?? data?.data.location.timezone);

  const w = data?.data;
  const aqi = data?.airQuality?.current?.us_aqi;
  const todayPop = w?.today.precipProbMax ?? 0;

  let miniBar: MiniBar | null = null;
  if (typeof aqi === 'number' && aqi > 0) {
    miniBar = {
      pct: Math.min(100, (aqi / 300) * 100),
      label: `AQI ${Math.round(aqi)}`,
      color: aqiColor(aqi),
    };
  } else if (todayPop >= 10) {
    miniBar = {
      pct: Math.min(100, todayPop),
      label: `${Math.round(todayPop)}% precip`,
      color: 'rgba(0,212,255,0.85)',
    };
  }

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: active ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.04)',
        borderColor: active ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.06)',
      }}
      className="w-full overflow-hidden rounded-xl border px-3 py-2.5 text-left transition-colors duration-150 hover:bg-white/[0.10]"
    >
      {/* Top row: name + temp */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            {city.isCurrent ? (
              <MapPin
                className="h-3.5 w-3.5"
                strokeWidth={2.2}
                style={{ color: 'var(--accent)' }}
              />
            ) : null}
            <span className="truncate text-[14px] font-semibold tracking-tight text-white">
              {city.name}
            </span>
          </div>
        </div>
        {w ? (
          <span className="tabular shrink-0 text-[26px] font-light leading-none text-white">
            {displayTemp(w.current.temp, settings, { withDegree: false })}°
          </span>
        ) : (
          <span className="h-7 w-12 shrink-0 rounded shimmer" />
        )}
      </div>

      {/* Middle row: time · condition + H/L */}
      <div className="mt-1.5 flex items-center justify-between gap-3 text-[11px]">
        <div className="min-w-0 flex-1 truncate text-white/65">
          <span className="tabular">
            {city.isCurrent ? 'My Location' : cityTime}
          </span>
          {w ? (
            <>
              <span className="mx-1.5 text-white/30">·</span>
              <span className="text-white/75">
                {describeCondition(w.current.temp, w.current.code)}
              </span>
            </>
          ) : null}
        </div>
        {w ? (
          <div className="tabular shrink-0 text-white/65">
            <span className="text-white/85">↑{displayTemp(w.today.high, settings, { withDegree: false })}°</span>
            <span className="ml-1.5 text-white/55">↓{displayTemp(w.today.low, settings, { withDegree: false })}°</span>
          </div>
        ) : null}
      </div>

      {/* Bottom row: mini-bar (AQI or precip) */}
      <div className="mt-2 flex items-center gap-2">
        <div className="flex h-[3px] flex-1 overflow-hidden rounded-full bg-white/10">
          {miniBar ? (
            <div
              className="h-full"
              style={{
                width: `${miniBar.pct}%`,
                background: miniBar.color,
              }}
            />
          ) : null}
        </div>
        <div className="text-[9px] font-semibold tracking-wider text-white/60 uppercase">
          {miniBar ? miniBar.label : w ? <WeatherIcon code={w.current.code} isDay={w.current.isDay} size={12} /> : '—'}
        </div>
      </div>
    </button>
  );
}
