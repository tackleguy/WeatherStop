// Full-page settings matching the UI board Units panel.

import {
  Bell,
  CloudRain,
  Database,
  Eye,
  Info,
  Layers,
  Ruler,
  Thermometer,
  Wind,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { useSettings } from '../hooks/useSettings';
import type { Settings } from '../types';

type Section =
  | 'general'
  | 'units'
  | 'notifications'
  | 'layers'
  | 'sources'
  | 'appearance'
  | 'about';

const SECTIONS: Array<{ id: Section; label: string; icon: LucideIcon }> = [
  { id: 'general', label: 'General', icon: Eye },
  { id: 'units', label: 'Units', icon: Ruler },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'layers', label: 'Layers', icon: Layers },
  { id: 'sources', label: 'Data Sources', icon: Database },
  { id: 'about', label: 'About', icon: Info },
];

export function SettingsView() {
  const { settings, update } = useSettings();
  const [section, setSection] = useState<Section>('units');
  const [alertsOn, setAlertsOn] = useState(true);

  return (
    <div className="absolute inset-0 flex flex-col overflow-hidden">
      <header className="border-b border-[var(--line-subtle)] px-4 py-3 sm:px-5">
        <p className="card-label">Settings</p>
        <h1 className="text-xl font-semibold text-[var(--ink-1)]">Preferences</h1>
      </header>

      <div className="grid min-h-0 flex-1 md:grid-cols-[220px_1fr]">
        <aside className="overflow-y-auto border-r border-[var(--line-subtle)] p-2">
          {SECTIONS.map((s) => {
            const Icon = s.icon;
            const active = section === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setSection(s.id)}
                className={`mb-0.5 flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[13px] font-medium transition-colors ${
                  active
                    ? 'bg-[var(--accent)] text-white'
                    : 'text-[var(--ink-3)] hover:bg-white/5 hover:text-[var(--ink-1)]'
                }`}
              >
                <Icon className="h-4 w-4" strokeWidth={1.8} />
                {s.label}
              </button>
            );
          })}
        </aside>

        <main className="overflow-y-auto p-5 sm:p-6">
          {section === 'units' ? (
            <div className="mx-auto max-w-lg space-y-5">
              <UnitRow
                icon={Thermometer}
                label="Temperature"
                value={settings.temp}
                options={[
                  { label: '°F', value: 'fahrenheit' },
                  { label: '°C', value: 'celsius' },
                ]}
                onChange={(v) => update('temp', v as Settings['temp'])}
              />
              <UnitRow
                icon={Wind}
                label="Wind"
                value={settings.wind}
                options={[
                  { label: 'mph', value: 'mph' },
                  { label: 'km/h', value: 'kmh' },
                ]}
                onChange={(v) => update('wind', v as Settings['wind'])}
              />
              <UnitRow
                icon={Ruler}
                label="Distance"
                value={settings.distance}
                options={[
                  { label: 'mi', value: 'mi' },
                  { label: 'km', value: 'km' },
                ]}
                onChange={(v) => update('distance', v as Settings['distance'])}
              />
              <UnitRow
                icon={CloudRain}
                label="Precipitation"
                value={settings.precip}
                options={[
                  { label: 'in', value: 'inch' },
                  { label: 'mm', value: 'mm' },
                ]}
                onChange={(v) => update('precip', v as Settings['precip'])}
              />
            </div>
          ) : null}

          {section === 'notifications' ? (
            <div className="panel panel-padded mx-auto max-w-lg">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-[var(--ink-1)]">
                    Severe Weather Alerts
                  </div>
                  <p className="mt-1 text-[12px] text-[var(--ink-4)]">
                    Highlight NWS warnings on Home and Radar.
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={alertsOn}
                  onClick={() => setAlertsOn((v) => !v)}
                  className={`relative h-7 w-12 rounded-full transition-colors ${
                    alertsOn ? 'bg-[var(--accent)]' : 'bg-white/15'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-6 w-6 rounded-full bg-white transition-transform ${
                      alertsOn ? 'translate-x-5' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>
            </div>
          ) : null}

          {section === 'sources' ? (
            <div className="panel panel-padded mx-auto max-w-lg space-y-2 text-[13px] text-[var(--ink-3)]">
              <p>NOAA / NWS — forecasts, alerts, radar</p>
              <p>NOAA / SPC — convective & fire outlooks</p>
              <p>Open-Meteo — global models & forecast</p>
              <p>Iowa State Mesonet — CONUS composite</p>
              <p>RainViewer — global radar / satellite</p>
              <p>OpenFreeMap — basemap</p>
            </div>
          ) : null}

          {section === 'general' ||
          section === 'layers' ||
          section === 'about' ? (
            <div className="panel panel-padded mx-auto max-w-lg text-[13px] text-[var(--ink-3)]">
              {section === 'about' ? (
                <>
                  <h2 className="mb-2 text-lg font-semibold text-[var(--ink-1)]">
                    WeatherStop
                  </h2>
                  <p>
                    Apple Weather, Windy, and WeatherWise — all in one. Forecast,
                    radar, models, and SPC outlooks with real meteorological
                    data.
                  </p>
                </>
              ) : (
                <p>
                  Additional {section} preferences will expand here. Units and
                  alerts are live now.
                </p>
              )}
            </div>
          ) : null}
        </main>
      </div>
    </div>
  );
}

function UnitRow<T extends string>({
  icon: Icon,
  label,
  value,
  options,
  onChange,
}: {
  icon: LucideIcon;
  label: string;
  value: T;
  options: Array<{ label: string; value: T }>;
  onChange: (v: T) => void;
}) {
  return (
    <div className="panel panel-padded flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <Icon className="h-4 w-4 text-[var(--accent-2)]" strokeWidth={1.8} />
        <span className="font-medium text-[var(--ink-1)]">{label}</span>
      </div>
      <div className="flex rounded-full bg-white/8 p-1">
        {options.map((opt) => {
          const active = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={`min-w-[52px] rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors ${
                active
                  ? 'bg-[var(--accent)] text-white'
                  : 'text-[var(--ink-3)] hover:text-[var(--ink-1)]'
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
