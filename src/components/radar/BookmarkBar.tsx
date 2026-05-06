// Save / restore named map views. Each bookmark captures center,
// zoom, active product, and timestamp at save time. A future version
// could capture the full filter / opacity state too — kept tight here
// so the persisted shape stays small.

import { Bookmark, BookmarkPlus, Trash2 } from 'lucide-react';
import type maplibregl from 'maplibre-gl';
import { useState } from 'react';
import { getProduct } from '../../constants/products';
import {
  useRadarStore,
  type BookmarkView,
} from '../../store/useRadarStore';

interface Props {
  map: maplibregl.Map | null;
}

export function BookmarkBar({ map }: Props) {
  const open = useRadarStore((s) => s.panelsOpen.bookmarks);
  const togglePanel = useRadarStore((s) => s.togglePanel);
  const bookmarks = useRadarStore((s) => s.bookmarks);
  const addBookmark = useRadarStore((s) => s.addBookmark);
  const removeBookmark = useRadarStore((s) => s.removeBookmark);
  const activeProduct = useRadarStore((s) => s.activeProduct);
  const setActiveProduct = useRadarStore((s) => s.setActiveProduct);
  const [draftName, setDraftName] = useState('');

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => togglePanel('bookmarks')}
        className="pointer-events-auto absolute left-4 bottom-[88px] z-10 flex items-center gap-1 rounded-lg border border-[var(--line-default)] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-2)] backdrop-blur-md hover:text-[var(--ink-1)]"
        style={{ background: 'var(--glass)' }}
      >
        <Bookmark className="h-3.5 w-3.5" strokeWidth={1.8} />
        Bookmarks
        {bookmarks.length > 0 ? (
          <span
            data-num
            className="rounded-full bg-white/10 px-1.5 py-0.5 text-[9px]"
          >
            {bookmarks.length}
          </span>
        ) : null}
      </button>
    );
  }

  const onSave = () => {
    if (!map) return;
    const c = map.getCenter();
    const view: BookmarkView = {
      id: crypto.randomUUID(),
      name: draftName.trim() || `View ${bookmarks.length + 1}`,
      center: [c.lng, c.lat],
      zoom: map.getZoom(),
      product: activeProduct,
      createdAt: Date.now(),
    };
    addBookmark(view);
    setDraftName('');
  };

  const onRestore = (b: BookmarkView) => {
    if (!map) return;
    setActiveProduct(b.product);
    map.flyTo({
      center: b.center,
      zoom: b.zoom,
      duration: 700,
    });
  };

  return (
    <div
      className="pointer-events-auto absolute left-4 bottom-[88px] z-10 w-72 rounded-xl border border-[var(--line-default)] backdrop-blur-md"
      style={{ background: 'var(--glass-hi)' }}
    >
      <header className="flex items-center justify-between border-b border-[var(--line-subtle)] px-3 py-2">
        <div className="flex items-center gap-1.5 text-[var(--ink-2)]">
          <Bookmark className="h-3.5 w-3.5" strokeWidth={1.8} />
          <span className="text-[11px] font-semibold uppercase tracking-wider">
            Bookmarks
          </span>
        </div>
        <button
          type="button"
          onClick={() => togglePanel('bookmarks')}
          className="text-[10px] font-semibold uppercase tracking-wider text-[var(--ink-3)] hover:text-[var(--ink-1)]"
        >
          Hide
        </button>
      </header>

      <div className="flex items-center gap-2 px-3 py-2">
        <input
          type="text"
          value={draftName}
          onChange={(e) => setDraftName(e.target.value)}
          placeholder="Name this view"
          className="flex-1 rounded-md bg-white/5 px-2 py-1 text-[12px] text-[var(--ink-1)] placeholder-[var(--ink-4)] outline-none focus:bg-white/10"
          onKeyDown={(e) => {
            if (e.key === 'Enter') onSave();
          }}
        />
        <button
          type="button"
          onClick={onSave}
          className="grid h-7 w-7 place-items-center rounded-md text-black"
          style={{ background: 'var(--accent)' }}
          aria-label="Save current view"
          title="Save current view"
        >
          <BookmarkPlus className="h-3.5 w-3.5" strokeWidth={2.4} />
        </button>
      </div>

      <ul className="max-h-72 divide-y divide-[var(--line-subtle)] overflow-y-auto">
        {bookmarks.length === 0 ? (
          <li className="px-3 py-3 text-[12px] text-[var(--ink-3)]">
            No bookmarks yet. Pan/zoom the map and save a view above.
          </li>
        ) : (
          bookmarks.map((b) => {
            const product = getProduct(b.product);
            return (
              <li
                key={b.id}
                className="flex items-center gap-2 px-3 py-2 hover:bg-white/3"
              >
                <button
                  type="button"
                  onClick={() => onRestore(b)}
                  className="flex-1 text-left"
                >
                  <div className="text-[12px] font-medium text-white">
                    {b.name}
                  </div>
                  <div className="tabular text-[10px] text-[var(--ink-3)]">
                    {product.shortLabel} · z{b.zoom.toFixed(1)} ·{' '}
                    {b.center[1].toFixed(2)}, {b.center[0].toFixed(2)}
                  </div>
                </button>
                <button
                  type="button"
                  aria-label={`Remove ${b.name}`}
                  onClick={() => removeBookmark(b.id)}
                  className="grid h-7 w-7 place-items-center rounded-md text-[var(--ink-3)] hover:bg-white/5 hover:text-[var(--sev-severe)]"
                >
                  <Trash2 className="h-3 w-3" strokeWidth={1.8} />
                </button>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}
