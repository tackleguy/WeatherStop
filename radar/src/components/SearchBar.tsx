// Geocoded search via Nominatim (OSM). 400 ms debounce, simple suggestion
// list, sends the picked feature back to the parent via `onPick`.
// Nominatim's usage policy: no more than 1 request per second per IP.
// 400 ms debouncing per keystroke + per-mount in-flight cancel is
// well within that limit.

import { Search, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

export interface GeoPick {
  lon: number;
  lat: number;
  label: string;
  bbox?: [number, number, number, number];
}

interface NominatimItem {
  lat: string;
  lon: string;
  display_name: string;
  boundingbox?: string[]; // [south, north, west, east]
  class?: string;
}

interface Props {
  onPick: (pick: GeoPick) => void;
}

export function SearchBar({ onPick }: Props) {
  const [q, setQ] = useState('');
  const [items, setItems] = useState<GeoPick[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const ctrlRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (timer.current) window.clearTimeout(timer.current);
    if (ctrlRef.current) ctrlRef.current.abort();
    if (!q.trim()) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    timer.current = window.setTimeout(() => {
      const ctrl = new AbortController();
      ctrlRef.current = ctrl;
      fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=6&q=${encodeURIComponent(q)}`,
        { signal: ctrl.signal, headers: { Accept: 'application/json' } },
      )
        .then((r) => r.json())
        .then((rows: NominatimItem[]) => {
          if (ctrl.signal.aborted) return;
          setItems(
            rows.map((r) => ({
              lat: parseFloat(r.lat),
              lon: parseFloat(r.lon),
              label: r.display_name,
              bbox: r.boundingbox
                ? [
                    parseFloat(r.boundingbox[2]),
                    parseFloat(r.boundingbox[0]),
                    parseFloat(r.boundingbox[3]),
                    parseFloat(r.boundingbox[1]),
                  ]
                : undefined,
            })),
          );
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }, 400);
  }, [q]);

  return (
    <div className="relative w-72">
      <div className="flex items-center gap-2 rounded-lg border border-white/8 bg-black/55 px-3 py-1.5 backdrop-blur-md">
        <Search className="h-3.5 w-3.5 text-white/65" strokeWidth={2.2} />
        <input
          ref={inputRef}
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Search location"
          className="flex-1 bg-transparent text-[13px] text-white placeholder-white/40 outline-none"
        />
        {q ? (
          <button
            type="button"
            aria-label="Clear"
            onClick={() => {
              setQ('');
              inputRef.current?.focus();
            }}
            className="text-white/50 hover:text-white"
          >
            <X className="h-3.5 w-3.5" strokeWidth={2.2} />
          </button>
        ) : null}
      </div>
      {open && (q.trim() ? items.length > 0 || loading : false) ? (
        <div className="absolute right-0 top-full mt-1 w-full overflow-hidden rounded-lg border border-white/8 bg-black/85 shadow-xl backdrop-blur-md">
          {loading && items.length === 0 ? (
            <div className="px-3 py-2 text-[12px] text-white/55">Searching…</div>
          ) : (
            <ul className="max-h-72 overflow-y-auto no-scrollbar">
              {items.map((it, i) => (
                <li key={i}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      onPick(it);
                      setOpen(false);
                      setQ('');
                    }}
                    className="block w-full px-3 py-2 text-left text-[12px] text-white/85 hover:bg-white/8"
                  >
                    {it.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
