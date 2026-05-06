// Floating pill nav rendered globally above every route. Active tab gets
// the warm accent. The brand block on the left is a permanent home link.

import {
  AlertTriangle,
  Globe,
  Home,
  Layers,
  LineChart,
  Radio,
  Zap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';

interface Tab {
  to: string;
  label: string;
  icon: LucideIcon;
}

const TABS: Tab[] = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/radar', label: 'Radar', icon: Radio },
  { to: '/composite', label: 'Composite', icon: Layers },
  { to: '/satellite', label: 'Satellite', icon: Globe },
  { to: '/models', label: 'Models', icon: LineChart },
  { to: '/outlooks', label: 'Outlooks', icon: AlertTriangle },
];

export function PillNav() {
  const loc = useLocation();
  const isHome = loc.pathname === '/' || loc.pathname.startsWith('/city/');

  return (
    <nav
      aria-label="Primary"
      className="pointer-events-auto fixed left-1/2 top-4 z-40 flex h-12 -translate-x-1/2 items-center gap-1 rounded-full border border-white/10 px-2 pl-3 backdrop-blur-[28px] sm:h-14 sm:gap-1.5 sm:px-3 sm:pl-4"
      style={{
        background: 'rgba(11, 16, 32, 0.78)',
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
            color: '#ff8a3d',
            filter: 'drop-shadow(0 0 6px rgba(255,138,61,0.45))',
          }}
          strokeWidth={2.2}
        />
        <span className="hidden sm:inline text-[13px] font-semibold tracking-tight text-white">
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
                    isActive || (t.to === '/' && isHome);
                  return [
                    'flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[12px] font-medium transition-all duration-150 sm:px-3.5 sm:py-2 sm:text-[13px]',
                    active
                      ? 'text-black shadow-[0_0_16px_rgba(255,138,61,0.5)]'
                      : 'text-white/70 hover:bg-white/5 hover:text-white',
                  ].join(' ');
                }}
                style={({ isActive }) => {
                  const active =
                    isActive || (t.to === '/' && isHome);
                  return active ? { background: '#ff8a3d' } : undefined;
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
