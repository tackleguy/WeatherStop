import { Radio, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { NEXRAD_SITES, type NexradSite } from '../lib/nexradSites';

interface StationStatus {
  online: boolean;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSelect: (site: NexradSite) => void;
  active?: string;
}

const NWS_STATIONS_URL = 'https://api.weather.gov/radar/stations';

export function StationInventory({ open, onClose, onSelect, active }: Props) {
  const [statusBySite, setStatusBySite] = useState<Record<string, StationStatus>>({});
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    const ctrl = new AbortController();
    setLoading(true);
    (async () => {
      try {
        const res = await fetch(NWS_STATIONS_URL, {
          signal: ctrl.signal,
          headers: { Accept: 'application/geo+json' },
        });
        if (!res.ok) throw new Error(`stations ${res.status}`);
        const json = (await res.json()) as {
          features: Array<{
            properties: { id: string; rda?: { properties?: { mode?: string } } };
          }>;
        };
        const map: Record<string, StationStatus> = {};
        for (const f of json.features ?? []) {
          const id = f.properties.id;
          const mode = f.properties.rda?.properties?.mode;
          map[id] = { online: mode === 'Operational' || mode === 'Operate' };
        }
        setStatusBySite(map);
      } catch {
        // leave statuses empty; offline fallback uses our static list
      } finally {
        setLoading(false);
      }
    })();
    return () => ctrl.abort();
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return NEXRAD_SITES;
    return NEXRAD_SITES.filter(
      (s) =>
        s.id.toLowerCase().includes(q) ||
        s.name.toLowerCase().includes(q) ||
        s.state.toLowerCase().includes(q),
    );
  }, [query]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="glass mx-4 flex h-[80vh] w-full max-w-3xl flex-col rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-white/8 px-5 py-3">
          <div className="flex items-center gap-2">
            <Radio className="h-4 w-4 text-white" strokeWidth={2.2} />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-white">
              NEXRAD Stations
            </h2>
            <span className="text-[11px] text-white/45">
              {filtered.length} sites · {loading ? 'syncing…' : 'live'}
            </span>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20"
          >
            <X className="h-4 w-4" strokeWidth={2.4} />
          </button>
        </header>

        <div className="px-5 py-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            type="search"
            placeholder="Search by ICAO, name, or state…"
            className="w-full rounded-lg bg-white/8 px-3 py-2 text-sm text-white placeholder-white/40 outline-none focus:bg-white/15"
          />
        </div>

        <ul className="grid flex-1 grid-cols-1 gap-1.5 overflow-y-auto px-5 pb-5 sm:grid-cols-2 md:grid-cols-3 no-scrollbar">
          {filtered.map((s) => {
            const status = statusBySite[s.id];
            const online = status?.online ?? true;
            const isActive = active === s.id;
            return (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => {
                    onSelect(s);
                    onClose();
                  }}
                  className={`w-full rounded-xl px-3 py-2 text-left transition-colors ${
                    isActive
                      ? 'bg-white/15 ring-1 ring-white/30'
                      : 'bg-white/5 hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-sm font-semibold text-white">
                      {s.id}
                    </span>
                    <span
                      className={`h-2 w-2 rounded-full ${
                        online ? 'bg-emerald-400' : 'bg-red-500'
                      }`}
                      aria-label={online ? 'online' : 'offline'}
                    />
                  </div>
                  <div className="truncate text-[11px] text-white/70">
                    {s.name}
                  </div>
                  <div className="text-[10px] text-white/45">{s.state}</div>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
