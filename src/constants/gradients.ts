import type { GradientName } from '../lib/weatherCodes';

// Windy-ish atmosphere palette: deeper, more saturated, never pure black
// or bright sky-blue. Each gradient is two stops only — Layer 2 (grain)
// + Layer 3 (particles) handle the rest of the visual texture.
export const GRADIENTS: Record<GradientName, string> = {
  'clear-day': 'from-[#1a3a5c] to-[#0f1e2e]',
  'clear-night': 'from-[#0a1a2e] to-[#050810]',
  'cloudy-day': 'from-[#2a3038] to-[#15181d]',
  'cloudy-night': 'from-[#1a1f29] to-[#0a0e15]',
  rain: 'from-[#1f2937] to-[#0c1117]',
  snow: 'from-[#2d3640] to-[#1a1d22]',
  thunderstorm: 'from-[#1a1525] to-[#06040a]',
  fog: 'from-[#262d36] to-[#10131a]',
  sunset: 'from-[#3d2540] to-[#1a0f1f]',
  sunrise: 'from-[#3a2818] to-[#181020]',
};

// Tinted top halos — subtler than before so the grain + particle layers
// can do the atmospheric work.
export const TOP_GLOW: Record<GradientName, string> = {
  'clear-day':
    'radial-gradient(ellipse 90% 60% at 50% 0%, rgba(56,189,248,0.22), rgba(0,0,0,0) 70%)',
  'clear-night':
    'radial-gradient(ellipse 90% 60% at 50% 0%, rgba(99,102,241,0.32), rgba(0,0,0,0) 70%)',
  'cloudy-day':
    'radial-gradient(ellipse 90% 60% at 50% 0%, rgba(255,255,255,0.18), rgba(0,0,0,0) 70%)',
  'cloudy-night':
    'radial-gradient(ellipse 90% 60% at 50% 0%, rgba(148,163,184,0.28), rgba(0,0,0,0) 70%)',
  rain: 'radial-gradient(ellipse 90% 60% at 50% 0%, rgba(96,165,250,0.25), rgba(0,0,0,0) 70%)',
  snow: 'radial-gradient(ellipse 90% 60% at 50% 0%, rgba(255,255,255,0.32), rgba(0,0,0,0) 70%)',
  thunderstorm:
    'radial-gradient(ellipse 90% 60% at 50% 0%, rgba(168,85,247,0.32), rgba(0,0,0,0) 70%)',
  fog: 'radial-gradient(ellipse 90% 60% at 50% 0%, rgba(226,232,240,0.25), rgba(0,0,0,0) 70%)',
  sunset:
    'radial-gradient(ellipse 90% 60% at 50% 0%, rgba(251,146,60,0.35), rgba(0,0,0,0) 70%)',
  sunrise:
    'radial-gradient(ellipse 90% 60% at 50% 0%, rgba(253,224,71,0.3), rgba(0,0,0,0) 70%)',
};
