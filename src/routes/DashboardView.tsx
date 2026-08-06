// Dashboard widget grid — glanceable metrics across saved cities.

import { Link } from 'react-router-dom';
import {
  CloudRain,
  Droplets,
  Gauge,
  Sun,
  Thermometer,
  Wind,
} from 'lucide-react';
import { useCities } from '../hooks/useCities';
import { useSettings } from '../hooks/useSettings';
import { useWeather } from '../hooks/useWeather';
import { useAlerts } from '../hooks/useAlerts';
import { displayTemp, displayWindSpeed } from '../lib/display';
import { INITIAL_SEED } from '../constants/cities';
import type { City, Settings } from '../types';

function CityWidgets({ city, settings }: { city: City; settings: Settings }) {
  const { data } = useWeather(city);
  const cur = data?.data.current;
  const today = data?.data.today;
  const aq = data?.airQuality;

  const tiles = [
    {
      label: 'Temperature',
      icon: Thermometer,
      value: cur
        ? displayTemp(cur.temp, settings, { withDegree: false }) + '°'
        : '—',
      sub: city.name,
    },
    {
      label: 'Wind',
      icon: Wind,
      value: cur ? displayWindSpeed(cur.windSpeed, settings) : '—',
      sub: city.name,
    },
    {
      label: 'Humidity',
      icon: Droplets,
      value: cur ? `${Math.round(cur.humidity)}%` : '—',
      sub: city.name,
    },
    {
      label: 'UV Index',
      icon: Sun,
      value: cur ? String(Math.round(cur.uvIndex)) : '—',
      sub: city.name,
    },
    {
      label: 'Precip chance',
      icon: CloudRain,
      value: today ? `${Math.round(today.precipProbMax)}%` : '—',
      sub: 'Today max',
    },
    {
      label: 'Pressure',
      icon: Gauge,
      value: cur ? `${cur.pressure.toFixed(2)} inHg` : '—',
      sub: city.name,
    },
    {
      label: 'Air Quality',
      icon: Gauge,
      value: aq?.current?.us_aqi !== undefined ? String(aq.current.us_aqi) : '—',
      sub: 'US AQI',
    },
  ];

  return (
    <>
      {tiles.map((t) => {
        const Icon = t.icon;
        return (
          <div key={`${city.id}-${t.label}`} className="panel panel-padded">
            <div className="mb-2 flex items-center justify-between">
              <span className="card-label">{t.label}</span>
              <Icon
                className="h-3.5 w-3.5 text-[var(--accent)]"
                strokeWidth={1.8}
              />
            </div>
            <div className="tabular text-2xl font-light text-[var(--ink-1)]">
              {t.value}
            </div>
            <div className="mt-1 text-[11px] text-[var(--ink-4)]">{t.sub}</div>
          </div>
        );
      })}
    </>
  );
}

export function DashboardView() {
  const { cities } = useCities();
  const { settings } = useSettings();
  const { alerts } = useAlerts();
  const focus = cities.slice(0, 2);
  const list = focus.length > 0 ? focus : INITIAL_SEED.slice(0, 1);

  return (
    <div className="absolute inset-0 overflow-y-auto px-4 py-5 sm:px-6">
      <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="card-label mb-1">Dashboard</p>
          <h1 className="text-2xl font-semibold text-[var(--ink-1)]">
            At a glance
          </h1>
        </div>
        <Link
          to="/cities"
          className="rounded-full border border-[var(--line-default)] px-3 py-1.5 text-[12px] text-[var(--ink-2)]"
        >
          Edit places
        </Link>
      </header>

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <Link to="/alerts" className="panel panel-padded block hover:bg-white/5">
          <div className="card-label mb-2">Severe Alerts</div>
          <div className="tabular text-2xl font-light text-[var(--ink-1)]">
            {alerts.length}
          </div>
          <div className="mt-1 text-[11px] text-[var(--ink-4)]">Active NWS</div>
        </Link>
        <Link
          to="/outlooks"
          className="panel panel-padded block hover:bg-white/5"
        >
          <div className="card-label mb-2">SPC Outlooks</div>
          <div className="text-2xl font-light text-[var(--accent)]">Open</div>
          <div className="mt-1 text-[11px] text-[var(--ink-4)]">Day 1–8</div>
        </Link>
        <Link to="/radar" className="panel panel-padded block hover:bg-white/5">
          <div className="card-label mb-2">Radar</div>
          <div className="text-2xl font-light text-[var(--ink-1)]">Live</div>
          <div className="mt-1 text-[11px] text-[var(--ink-4)]">Map view</div>
        </Link>
        <Link to="/models" className="panel panel-padded block hover:bg-white/5">
          <div className="card-label mb-2">Models</div>
          <div className="text-2xl font-light text-[var(--ink-1)]">Compare</div>
          <div className="mt-1 text-[11px] text-[var(--ink-4)]">Open-Meteo</div>
        </Link>
      </div>

      <h2 className="mb-3 text-[13px] font-semibold text-[var(--ink-2)]">
        Places
      </h2>
      <div className="grid grid-cols-2 gap-3 pb-10 sm:grid-cols-3 lg:grid-cols-4">
        {list.map((c) => (
          <CityWidgets key={c.id} city={c} settings={settings} />
        ))}
      </div>
    </div>
  );
}
