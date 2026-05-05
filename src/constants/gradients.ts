import type { GradientName } from '../lib/weatherCodes';

// Tailwind gradient class strings indexed by gradient name. Colors are
// chosen so the top of the viewport always reads as a clear sky tint — no
// gradient bottoms out at black.
export const GRADIENTS: Record<GradientName, string> = {
  'clear-day': 'from-sky-300 via-sky-500 to-blue-700',
  'clear-night': 'from-indigo-700 via-indigo-900 to-slate-800',
  'cloudy-day': 'from-slate-300 via-slate-500 to-slate-700',
  'cloudy-night': 'from-slate-500 via-slate-700 to-slate-900',
  rain: 'from-slate-500 via-slate-600 to-slate-800',
  snow: 'from-slate-200 via-slate-400 to-slate-600',
  thunderstorm: 'from-purple-700 via-indigo-900 to-slate-900',
  fog: 'from-slate-400 via-slate-500 to-slate-700',
  sunset: 'from-orange-400 via-pink-500 to-purple-700',
  sunrise: 'from-orange-300 via-amber-400 to-sky-500',
};

// Tinted top-of-viewport halos for the radial overlay. Picked to hint at
// horizon light without overwhelming the gradient.
export const TOP_GLOW: Record<GradientName, string> = {
  'clear-day':
    'radial-gradient(ellipse 100% 75% at 50% 0%, rgba(255,255,255,0.35), rgba(255,255,255,0) 70%)',
  'clear-night':
    'radial-gradient(ellipse 100% 75% at 50% 0%, rgba(99,102,241,0.65), rgba(15,23,42,0) 70%)',
  'cloudy-day':
    'radial-gradient(ellipse 100% 75% at 50% 0%, rgba(255,255,255,0.3), rgba(255,255,255,0) 70%)',
  'cloudy-night':
    'radial-gradient(ellipse 100% 75% at 50% 0%, rgba(148,163,184,0.55), rgba(15,23,42,0) 70%)',
  rain: 'radial-gradient(ellipse 100% 75% at 50% 0%, rgba(148,163,184,0.45), rgba(15,23,42,0) 70%)',
  snow: 'radial-gradient(ellipse 100% 75% at 50% 0%, rgba(255,255,255,0.45), rgba(255,255,255,0) 70%)',
  thunderstorm:
    'radial-gradient(ellipse 100% 75% at 50% 0%, rgba(168,85,247,0.55), rgba(15,23,42,0) 70%)',
  fog: 'radial-gradient(ellipse 100% 75% at 50% 0%, rgba(226,232,240,0.45), rgba(15,23,42,0) 70%)',
  sunset:
    'radial-gradient(ellipse 100% 75% at 50% 0%, rgba(251,146,60,0.5), rgba(15,23,42,0) 70%)',
  sunrise:
    'radial-gradient(ellipse 100% 75% at 50% 0%, rgba(253,224,71,0.5), rgba(15,23,42,0) 70%)',
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
