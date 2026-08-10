// Floating pill nav rendered globally above every route. Active tab gets
// the warm accent. The brand block on the left is a permanent home link.

import {
  AlertTriangle,
  Home,
  LineChart,
  Map,
  Zap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';

interface Tab {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Paths that should also mark this tab active. */
  match?: (path: string) => boolean;
}

const TABS: Tab[] = [
  { to: '/', label: 'Home', icon: Home },
  {
    to: '/map',
    label: 'Map',
    icon: Map,
    match: (p) =>
      p === '/map' ||
      p === '/radar' ||
      p === '/composite' ||
      p === '/satellite',
  },
  { to: '/outlooks', label: 'Outlooks', icon: AlertTriangle },
  { to: '/models', label: 'Models', icon: LineChart },
];

export function PillNav() {
  const loc = useLocation();
  const isHome = loc.pathname === '/' || loc.pathname.startsWith('/city/');

  return (
    <nav
      aria-label="Primary"
      className="pointer-events-auto fixed left-1/2 top-4 z-40 flex h-12 -translate-x-1/2 items-center gap-1 rounded-full border border-white/10 px-2 pl-3 backdrop-blur-[28px] sm:h-14 sm:gap-1.5 sm:px-3 sm:pl-4"
      style={{
        background: 'var(--glass)',
        boxShadow: '0 8px 32px -8px rgba(0,0,0,0.5)',
      }}
    >
      <NavLink
        to="/"
        className="flex items-center gap-1.5 pr-1.5 sm:pr-2"
        aria-label="WeatherStop home"
      >
        <Zap
          className="h-4 w-4"
          style={{
            color: 'var(--accent)',
            filter: 'drop-shadow(0 0 6px var(--accent-glow))',
          }}
          strokeWidth={2.2}
        />
        <span className="hidden sm:inline text-[13px] font-semibold tracking-tight text-[var(--ink-1)]">
          WeatherStop
        </span>
      </NavLink>
      <span className="mx-0.5 h-6 w-px bg-white/10 sm:mx-1" />
      <ul className="flex items-center gap-0.5 sm:gap-1">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <li key={t.to}>
              <NavLink
                to={t.to}
                end={t.to === '/'}
                className={({ isActive }) => {
                  const active =
                    isActive ||
                    (t.to === '/' && isHome) ||
                    (t.match?.(loc.pathname) ?? false);
                  return [
                    'flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[12px] font-medium transition-all duration-[var(--t-fast)] ease-[var(--ease)] sm:px-3.5 sm:py-2 sm:text-[13px]',
                    active
                      ? 'text-white shadow-[0_0_16px_var(--accent-glow)]'
                      : 'text-[var(--ink-3)] hover:bg-[var(--hover-fill)] hover:text-[var(--ink-1)]',
                  ].join(' ');
                }}
                style={({ isActive }) => {
                  const active =
                    isActive ||
                    (t.to === '/' && isHome) ||
                    (t.match?.(loc.pathname) ?? false);
                  return active
                    ? { background: 'var(--accent)' }
                    : undefined;
                }}
              >
                <Icon className="h-3.5 w-3.5" strokeWidth={2} />
                <span className="hidden sm:inline">{t.label}</span>
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
