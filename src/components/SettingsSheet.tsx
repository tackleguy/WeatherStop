import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import type { Settings } from '../types';

interface Props {
  open: boolean;
  onClose: () => void;
  settings: Settings;
  onChange: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
}

interface Toggle<K extends keyof Settings> {
  label: string;
  key: K;
  options: { label: string; value: Settings[K] }[];
}

const TOGGLES: [
  Toggle<'temp'>,
  Toggle<'wind'>,
  Toggle<'distance'>,
  Toggle<'precip'>,
] = [
  {
    label: 'Temperature',
    key: 'temp',
    options: [
      { label: '°F', value: 'fahrenheit' },
      { label: '°C', value: 'celsius' },
    ],
  },
  {
    label: 'Wind',
    key: 'wind',
    options: [
      { label: 'mph', value: 'mph' },
      { label: 'km/h', value: 'kmh' },
    ],
  },
  {
    label: 'Distance',
    key: 'distance',
    options: [
      { label: 'mi', value: 'mi' },
      { label: 'km', value: 'km' },
    ],
  },
  {
    label: 'Precipitation',
    key: 'precip',
    options: [
      { label: 'in', value: 'inch' },
      { label: 'mm', value: 'mm' },
    ],
  },
];

export function SettingsSheet({ open, onClose, settings, onChange }: Props) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="settings"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="absolute inset-x-0 bottom-0 mx-auto max-w-md rounded-t-3xl bg-slate-900/95 p-5 backdrop-blur-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-medium text-white">Settings</h2>
              <button
                type="button"
                aria-label="Close"
                onClick={onClose}
                className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20"
              >
                <X className="h-4 w-4" strokeWidth={2.5} />
              </button>
            </div>

            <div className="space-y-3">
              {TOGGLES.map((row) => (
                <div
                  key={row.label}
                  className="flex items-center justify-between rounded-2xl bg-white/8 px-4 py-3"
                >
                  <span className="text-[15px] text-white">{row.label}</span>
                  <div className="flex rounded-full bg-white/10 p-0.5">
                    {row.options.map((opt) => {
                      const active =
                        (settings as Settings)[row.key] === opt.value;
                      return (
                        <button
                          key={String(opt.value)}
                          type="button"
                          onClick={() =>
                            onChange(row.key, opt.value as Settings[typeof row.key])
                          }
                          className={`min-w-[48px] rounded-full px-3 py-1 text-[13px] font-medium transition-colors ${
                            active ? 'bg-white text-slate-900' : 'text-white/80'
                          }`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <p className="mt-5 text-center text-[12px] text-white/50">
              Data from Open-Meteo. WeatherStop has no API keys.
            </p>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
