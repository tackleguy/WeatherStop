// Left icon rail matching the WeatherStop UI board (12 destinations).

import {
  AlertTriangle,
  Bell,
  CloudSun,
  Flag,
  Gauge,
  GitCompare,
  Globe,
  Home,
  LayoutDashboard,
  LineChart,
  Map,
  Radio,
  Search,
  Settings,
  Waves,
  Wind,
  Zap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
import { useIsMobile } from '../../hooks/useMediaQuery';

interface Tab {
  to: string;
  label: string;
  icon: LucideIcon;
  match?: (path: string) => boolean;
}

const PRIMARY: Tab[] = [
  { to: '/', label: 'Home', icon: Home },
  {
    to: '/radar',
    label: 'Radar',
    icon: Radio,
    match: (p) => p === '/radar' || p === '/map',
  },
  { to: '/wind', label: 'Wind', icon: Wind },
  { to: '/satellite', label: 'Satellite', icon: Globe },
  { to: '/forecast', label: 'Forecast', icon: CloudSun },
  { to: '/alerts', label: 'Alerts', icon: Bell },
  { to: '/outlooks', label: 'Outlooks', icon: AlertTriangle },
  { to: '/tropical', label: 'Tropical', icon: Waves },
  { to: '/models', label: 'Models', icon: LineChart },
  { to: '/golf', label: 'Golf', icon: Flag },
  { to: '/cities', label: 'Cities', icon: Map },
  { to: '/compare', label: 'Compare', icon: GitCompare },
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
];

const SECONDARY: Tab[] = [
  { to: '/search', label: 'Search', icon: Search },
  { to: '/settings', label: 'Settings', icon: Settings },
];

function NavItem({ tab }: { tab: Tab }) {
  const loc = useLocation();
  const Icon = tab.icon;
  const isHome = loc.pathname === '/' || loc.pathname.startsWith('/city/');

  return (
    <NavLink
      to={tab.to}
      end={tab.to === '/'}
      title={tab.label}
      aria-label={tab.label}
      className={({ isActive }) => {
        const active =
          isActive ||
          (tab.to === '/' && isHome) ||
          (tab.match?.(loc.pathname) ?? false);
        return [
          'group relative flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-[var(--t-fast)]',
          active
            ? 'text-white shadow-[0_0_18px_var(--accent-glow)]'
            : 'text-[var(--ink-3)] hover:bg-white/5 hover:text-[var(--ink-1)]',
        ].join(' ');
      }}
      style={({ isActive }) => {
        const active =
          isActive ||
          (tab.to === '/' && isHome) ||
          (tab.match?.(loc.pathname) ?? false);
        return active ? { background: 'var(--accent)' } : undefined;
      }}
    >
      <Icon className="h-[18px] w-[18px]" strokeWidth={1.8} />
      <span className="pointer-events-none absolute left-full ml-2 hidden whitespace-nowrap rounded-md bg-[var(--glass-hi)] px-2 py-1 text-[11px] font-medium text-[var(--ink-1)] opacity-0 shadow-lg ring-1 ring-white/10 transition-opacity group-hover:opacity-100 lg:block">
        {tab.label}
      </span>
    </NavLink>
  );
}

export function SideNav() {
  const isMobile = useIsMobile();

  if (isMobile) {
    const mobileTabs = [
      PRIMARY[0],
      PRIMARY[1],
      PRIMARY[4],
      PRIMARY[5],
      PRIMARY[8],
      SECONDARY[1],
    ];
    return (
      <nav
        aria-label="Primary"
        className="pointer-events-auto fixed inset-x-0 bottom-0 z-40 flex h-[4.25rem] items-center justify-around border-t border-[var(--line-subtle)] px-1 pb-[env(safe-area-inset-bottom)] backdrop-blur-[28px]"
        style={{ background: 'var(--glass)' }}
      >
        {mobileTabs.map((t) => (
          <NavItem key={t.to} tab={t} />
        ))}
      </nav>
    );
  }

  return (
    <nav
      aria-label="Primary"
      className="pointer-events-auto fixed left-0 top-0 z-40 flex h-[100dvh] w-[var(--sidebar-w)] flex-col items-center border-r border-[var(--line-subtle)] py-3 backdrop-blur-[28px]"
      style={{ background: 'var(--glass)' }}
    >
      <NavLink
        to="/"
        aria-label="WeatherStop home"
        className="mb-3 grid h-10 w-10 place-items-center rounded-xl"
      >
        <Zap
          className="h-5 w-5"
          style={{
            color: 'var(--brand)',
            filter: 'drop-shadow(0 0 8px var(--brand-glow))',
          }}
          strokeWidth={2.2}
        />
      </NavLink>

      <div className="flex flex-1 flex-col items-center gap-1 overflow-y-auto no-scrollbar py-1">
        {PRIMARY.map((t) => (
          <NavItem key={t.to} tab={t} />
        ))}
      </div>

      <div className="mt-auto flex flex-col items-center gap-1 border-t border-[var(--line-subtle)] pt-2">
        {SECONDARY.map((t) => (
          <NavItem key={t.to} tab={t} />
        ))}
        <Gauge className="mt-1 h-3.5 w-3.5 text-[var(--ink-4)]" strokeWidth={1.6} aria-hidden />
      </div>
    </nav>
  );
}
