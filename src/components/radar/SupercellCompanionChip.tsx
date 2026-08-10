// Tiny companion links to the Supercell Wx desktop app (MIT, native).
// Intentionally very small — not a promo card.

import { isForecastProduct } from '../../hooks/useTimeFrames';
import { useRadarStore } from '../../store/useRadarStore';

const DOWNLOAD = 'https://supercellwx.net/';
const DOCS = 'https://supercell-wx.readthedocs.io/';

export function SupercellCompanionChip() {
  const product = useRadarStore((s) => s.activeProduct);
  // Hide over Nullschool forecast embeds.
  if (isForecastProduct(product)) return null;

  return (
    <div className="pointer-events-auto flex items-center gap-1.5 text-[9px] leading-none text-[var(--ink-3)]">
      <a
        href={DOWNLOAD}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded px-1 py-0.5 underline-offset-2 hover:text-[var(--ink-2)] hover:underline"
        title="Download Supercell Wx (desktop radar)"
      >
        Supercell Wx ↗
      </a>
      <span aria-hidden className="opacity-40">
        ·
      </span>
      <a
        href={DOCS}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded px-0.5 py-0.5 underline-offset-2 hover:text-[var(--ink-2)] hover:underline"
        title="Supercell Wx documentation"
      >
        docs
      </a>
    </div>
  );
}
