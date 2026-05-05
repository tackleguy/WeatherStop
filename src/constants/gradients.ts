import type { GradientName } from '../lib/weatherCodes';

// Tailwind gradient class strings indexed by gradient name.
// We pre-list every variant so Tailwind's JIT picks them up.
export const GRADIENTS: Record<GradientName, string> = {
  'clear-day': 'from-sky-400 via-sky-500 to-blue-700',
  'clear-night': 'from-indigo-950 via-slate-900 to-black',
  'cloudy-day': 'from-slate-400 via-slate-500 to-slate-700',
  'cloudy-night': 'from-slate-800 via-slate-900 to-black',
  rain: 'from-slate-700 via-slate-800 to-slate-950',
  snow: 'from-slate-300 via-slate-400 to-slate-600',
  thunderstorm: 'from-slate-900 via-purple-950 to-black',
  fog: 'from-slate-500 via-slate-600 to-slate-800',
  sunset: 'from-orange-400 via-pink-500 to-purple-700',
  sunrise: 'from-orange-300 via-amber-400 to-sky-500',
};

// Hint at the dominant accent for child UI.
export const ACCENTS: Record<GradientName, string> = {
  'clear-day': '#38bdf8',
  'clear-night': '#1e1b4b',
  'cloudy-day': '#94a3b8',
  'cloudy-night': '#0f172a',
  rain: '#1e293b',
  snow: '#cbd5e1',
  thunderstorm: '#3b0764',
  fog: '#475569',
  sunset: '#f97316',
  sunrise: '#fbbf24',
};
