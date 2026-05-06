// Token re-exports as TS values, for cases where we need the literal in JS
// (e.g. SVG fill attributes, dynamic style props).

export const TOKENS = {
  surface: {
    0: '#060912',
    1: '#0b1020',
    2: '#111830',
    3: '#1a2240',
  },
  ink: {
    1: '#f4f6fb',
    2: 'rgba(244, 246, 251, 0.78)',
    3: 'rgba(244, 246, 251, 0.56)',
    4: 'rgba(244, 246, 251, 0.36)',
  },
  accent: '#ff8a3d',
  accent2: '#ffb066',
  accentGlow: 'rgba(255, 138, 61, 0.35)',
  cool: '#4dd9ff',
  severity: {
    extreme: '#d946ef',
    severe: '#ef4444',
    moderate: '#f59e0b',
    minor: '#fbbf24',
    unknown: '#94a3b8',
  },
} as const;
