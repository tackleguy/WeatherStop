// Full-page settings matching the UI board Units panel.

import {
  Bell,
  BrainCircuit,
  CloudRain,
  Database,
  Eye,
  Info,
  Layers,
  Map as MapIcon,
  Moon,
  Palette,
  Ruler,
  Thermometer,
  Wind,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { useSettings } from '../hooks/useSettings';
import type { MapStyleId, Settings, ThemeId } from '../types';
import { THEME_OPTIONS } from '../lib/theme';
import { MAP_STYLES } from '../lib/mapStyles';

type Section =
  | 'general'
  | 'units'
  | 'notifications'
  | 'layers'
  | 'sources'
  | 'local-ai'
  | 'appearance'
  | 'about';

const SECTIONS: Array<{ id: Section; label: string; icon: LucideIcon }> = [
  { id: 'general', label: 'General', icon: Eye },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'units', label: 'Units', icon: Ruler },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'layers', label: 'Layers', icon: Layers },
  { id: 'local-ai', label: 'Local AI', icon: BrainCircuit },
  { id: 'sources', label: 'Data Sources', icon: Database },
  { id: 'about', label: 'About', icon: Info },
];

export function SettingsView() {
  const { settings, update } = useSettings();
  const [section, setSection] = useState<Section>('appearance');
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
                className={`mb-0.5 flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[13px] font-medium transition-colors duration-[var(--t-fast)] ${
                  active
                    ? 'bg-[var(--accent)] text-white'
                    : 'text-[var(--ink-3)] hover:bg-[var(--hover-fill)] hover:text-[var(--ink-1)]'
                }`}
              >
                <Icon className="h-4 w-4" strokeWidth={1.8} />
                {s.label}
              </button>
            );
          })}
        </aside>

        <main className="overflow-y-auto p-5 sm:p-6">
          {section === 'appearance' ? (
            <div className="mx-auto max-w-lg space-y-5">
              <div className="panel panel-padded space-y-3">
                <div className="flex items-center gap-2">
                  <Moon className="h-4 w-4 text-[var(--accent-2)]" strokeWidth={1.8} />
                  <span className="font-medium text-[var(--ink-1)]">Theme</span>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {THEME_OPTIONS.map((opt) => {
                    const active = settings.theme === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => update('theme', opt.id as ThemeId)}
                        className={`rounded-xl border px-3 py-2.5 text-left transition-all duration-[var(--t-fast)] ${
                          active
                            ? 'border-[var(--accent)] bg-[var(--accent)]/15'
                            : 'border-[var(--line-default)] hover:bg-[var(--hover-fill)]'
                        }`}
                      >
                        <div className="text-[13px] font-semibold text-[var(--ink-1)]">
                          {opt.label}
                        </div>
                        <div className="mt-0.5 text-[10px] leading-snug text-[var(--ink-3)]">
                          {opt.description}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="panel panel-padded space-y-3">
                <div className="flex items-center gap-2">
                  <MapIcon className="h-4 w-4 text-[var(--accent-2)]" strokeWidth={1.8} />
                  <span className="font-medium text-[var(--ink-1)]">Map style</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {MAP_STYLES.map((style) => {
                    const active = settings.mapStyle === style.id;
                    return (
                      <button
                        key={style.id}
                        type="button"
                        onClick={() => update('mapStyle', style.id as MapStyleId)}
                        className={`min-w-[72px] rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors duration-[var(--t-fast)] ${
                          active
                            ? 'bg-[var(--accent)] text-white'
                            : 'bg-[var(--hover-fill)] text-[var(--ink-3)] hover:text-[var(--ink-1)]'
                        }`}
                      >
                        {style.label}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11px] text-[var(--ink-4)]">
                  Also available from the Map control on the radar view.
                </p>
              </div>
            </div>
          ) : null}

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
                    alertsOn ? 'bg-[var(--accent)]' : 'bg-[var(--track)]'
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

          {section === 'local-ai' ? (
            <div className="mx-auto max-w-lg space-y-4">
              <div className="panel panel-padded space-y-3">
                <div className="flex items-center gap-2">
                  <BrainCircuit
                    className="h-4 w-4 text-cyan-300"
                    strokeWidth={1.8}
                  />
                  <span className="font-medium text-[var(--ink-1)]">
                    Storm chase · local AI
                  </span>
                </div>
                <p className="text-[12px] leading-relaxed text-[var(--ink-3)]">
                  Chase mode always runs an on-device brief from NWS alerts. Optional{' '}
                  <strong className="text-[var(--ink-2)]">Ollama</strong> polishes
                  wording and answers chase questions — nothing is sent to OpenAI
                  unless you configure that separately on the server.
                </p>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[13px] text-[var(--ink-2)]">
                    Enable local LLM
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={settings.localAiEnabled !== false}
                    onClick={() =>
                      update(
                        'localAiEnabled',
                        !(settings.localAiEnabled !== false),
                      )
                    }
                    className={`relative h-7 w-12 rounded-full transition-colors ${
                      settings.localAiEnabled !== false
                        ? 'bg-[var(--accent)]'
                        : 'bg-[var(--track)]'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 h-6 w-6 rounded-full bg-white transition-transform ${
                        settings.localAiEnabled !== false
                          ? 'translate-x-5'
                          : 'translate-x-0.5'
                      }`}
                    />
                  </button>
                </div>
                <label className="block space-y-1">
                  <span className="text-[11px] uppercase tracking-wider text-[var(--ink-4)]">
                    Ollama URL
                  </span>
                  <input
                    type="url"
                    value={settings.localAiUrl ?? 'http://127.0.0.1:11434'}
                    onChange={(e) => update('localAiUrl', e.target.value)}
                    className="w-full rounded-xl border border-[var(--line-default)] bg-black/20 px-3 py-2 text-[13px] text-[var(--ink-1)] outline-none focus:border-[var(--accent)]"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-[11px] uppercase tracking-wider text-[var(--ink-4)]">
                    Model
                  </span>
                  <input
                    type="text"
                    value={settings.localAiModel ?? 'llama3.2'}
                    onChange={(e) => update('localAiModel', e.target.value)}
                    className="w-full rounded-xl border border-[var(--line-default)] bg-black/20 px-3 py-2 text-[13px] text-[var(--ink-1)] outline-none focus:border-[var(--accent)]"
                    placeholder="llama3.2"
                  />
                </label>
                <p className="text-[11px] leading-relaxed text-[var(--ink-4)]">
                  Run <code className="text-[var(--ink-3)]">ollama pull llama3.2</code>{' '}
                  then <code className="text-[var(--ink-3)]">ollama serve</code>.
                  For browser access set{' '}
                  <code className="text-[var(--ink-3)]">
                    OLLAMA_ORIGINS=&quot;http://localhost:5173&quot;
                  </code>
                  . For API proxy set{' '}
                  <code className="text-[var(--ink-3)]">
                    LOCAL_AI_URL=http://127.0.0.1:11434
                  </code>
                  .
                </p>
              </div>

              <div className="panel panel-padded space-y-3">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-[var(--ink-1)]">
                    Dominator 3 feed
                  </span>
                </div>
                <p className="text-[12px] leading-relaxed text-[var(--ink-3)]">
                  Optional public JSON / GeoJSON URL for Dom 3 (or any chase
                  vehicle). There is no official Team Dominator GPS API — only
                  use feeds you are allowed to display.
                </p>
                <label className="block space-y-1">
                  <span className="text-[11px] uppercase tracking-wider text-[var(--ink-4)]">
                    Feed URL
                  </span>
                  <input
                    type="url"
                    value={settings.dom3FeedUrl ?? ''}
                    onChange={(e) => update('dom3FeedUrl', e.target.value)}
                    placeholder="https://example.com/dom3.json"
                    className="w-full rounded-xl border border-[var(--line-default)] bg-black/20 px-3 py-2 text-[13px] text-[var(--ink-1)] outline-none focus:border-[var(--accent)]"
                  />
                </label>
              </div>
            </div>
          ) : null}

          {section === 'sources' ? (
            <div className="panel panel-padded mx-auto max-w-lg space-y-2 text-[13px] text-[var(--ink-3)]">
              <p>NOAA / NWS — forecasts, alerts, radar</p>
              <p>NOAA / SPC — convective & fire outlooks</p>
              <p>NOAA NEXRAD Level 2/3 — site radar (AWS Open Data)</p>
              <p>Open-Meteo — global models & city forecasts</p>
              <p>Earth Nullschool — wind / temp / rain map</p>
              <p>Iowa State Mesonet — CONUS composite</p>
              <p>RainViewer — global radar / satellite</p>
              <p>OpenFreeMap — basemap</p>
              <p className="pt-1 text-[10px] leading-snug text-[var(--ink-3)]">
                Companion desktop radar:{' '}
                <a
                  href="https://supercellwx.net/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-2 hover:text-[var(--ink-2)]"
                >
                  Supercell Wx
                </a>{' '}
                (MIT) ·{' '}
                <a
                  href="https://supercell-wx.readthedocs.io/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-2 hover:text-[var(--ink-2)]"
                >
                  docs
                </a>
              </p>
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
                  Additional {section} preferences will expand here. Appearance,
                  units, and alerts are live now.
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
      <div className="flex rounded-full bg-[var(--hover-fill)] p-1">
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
