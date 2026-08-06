// Tropical / NHC — live link-outs + Atlantic/EPAC map context via Outlooks-style
// shell until full cone overlays land.

import { ExternalLink, Waves } from 'lucide-react';
import { Link } from 'react-router-dom';

const LINKS = [
  {
    title: 'NHC Atlantic',
    href: 'https://www.nhc.noaa.gov/cyclones/',
    blurb: 'Active tropical cyclones, advisories, and cone graphics.',
  },
  {
    title: 'NHC East Pacific',
    href: 'https://www.nhc.noaa.gov/cyclones/?basin=ep',
    blurb: 'Eastern Pacific basin products and discussions.',
  },
  {
    title: 'NHC Two-Day Graphical',
    href: 'https://www.nhc.noaa.gov/gtwo.php',
    blurb: 'Tropical weather outlook — disturbance areas.',
  },
  {
    title: 'Satellite IR (GOES)',
    href: '/satellite',
    blurb: 'Jump to WeatherStop satellite IR on the map.',
    internal: true,
  },
];

export function TropicalView() {
  return (
    <div className="absolute inset-0 overflow-y-auto px-4 py-5 sm:px-6">
      <header className="mb-6">
        <p className="card-label mb-1">Tropical</p>
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-[var(--ink-1)]">
          <Waves className="h-6 w-6 text-[var(--accent)]" strokeWidth={1.8} />
          NHC & basin products
        </h1>
        <p className="mt-2 max-w-xl text-[13px] text-[var(--ink-3)]">
          Official National Hurricane Center products. Cone overlays and
          spaghetti tracks will attach to the map in a later pass — these
          open the live NOAA sources now.
        </p>
      </header>

      <div className="mx-auto grid max-w-3xl gap-3 sm:grid-cols-2">
        {LINKS.map((l) =>
          l.internal ? (
            <Link
              key={l.title}
              to={l.href}
              className="panel panel-padded block transition-colors hover:bg-white/5"
            >
              <h2 className="text-[15px] font-semibold text-[var(--ink-1)]">
                {l.title}
              </h2>
              <p className="mt-1 text-[12px] text-[var(--ink-4)]">{l.blurb}</p>
            </Link>
          ) : (
            <a
              key={l.title}
              href={l.href}
              target="_blank"
              rel="noreferrer"
              className="panel panel-padded block transition-colors hover:bg-white/5"
            >
              <h2 className="flex items-center gap-2 text-[15px] font-semibold text-[var(--ink-1)]">
                {l.title}
                <ExternalLink className="h-3.5 w-3.5 text-[var(--ink-4)]" />
              </h2>
              <p className="mt-1 text-[12px] text-[var(--ink-4)]">{l.blurb}</p>
            </a>
          ),
        )}
      </div>

      <div className="mx-auto mt-6 max-w-3xl panel panel-padded">
        <h2 className="mb-2 text-[14px] font-semibold text-[var(--ink-1)]">
          Also useful
        </h2>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/outlooks"
            className="rounded-full bg-[var(--accent)] px-3 py-1.5 text-[12px] font-semibold text-white"
          >
            SPC Outlooks
          </Link>
          <Link
            to="/alerts"
            className="rounded-full border border-[var(--line-default)] px-3 py-1.5 text-[12px] text-[var(--ink-2)]"
          >
            NWS Alerts
          </Link>
          <Link
            to="/radar"
            className="rounded-full border border-[var(--line-default)] px-3 py-1.5 text-[12px] text-[var(--ink-2)]"
          >
            Radar
          </Link>
        </div>
      </div>
    </div>
  );
}
