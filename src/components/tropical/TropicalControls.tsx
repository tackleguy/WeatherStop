import { motion } from 'framer-motion';
import { ExternalLink } from 'lucide-react';
import {
  BASIN_LABELS,
  TROPICAL_PRODUCTS,
  type TropicalBasin,
  type TropicalProduct,
} from '../../lib/nhcTropical';

const BASINS: TropicalBasin[] = ['all', 'atl', 'epac', 'cpac'];

interface Props {
  basin: TropicalBasin;
  product: TropicalProduct;
  onBasinChange: (b: TropicalBasin) => void;
  onProductChange: (p: TropicalProduct) => void;
  loading?: boolean;
}

export function TropicalControls({
  basin,
  product,
  onBasinChange,
  onProductChange,
  loading,
}: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
      className="pointer-events-auto absolute left-3 right-3 top-3 z-20 flex max-h-[42%] flex-col gap-2 overflow-y-auto sm:left-3 sm:right-auto sm:max-w-xl"
    >
      <div
        className="flex flex-wrap items-center gap-1.5 rounded-xl border border-[var(--line-default)] px-2 py-2 backdrop-blur-[28px]"
        style={{ background: 'var(--glass-hi)' }}
      >
        {BASINS.map((id) => {
          const active = basin === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onBasinChange(id)}
              className={`rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-all duration-[var(--t-fast)] ${
                active
                  ? 'text-black'
                  : 'text-[var(--ink-3)] hover:bg-white/5 hover:text-[var(--ink-1)]'
              }`}
              style={
                active
                  ? {
                      background: 'var(--accent)',
                      boxShadow: '0 0 12px var(--accent-glow)',
                    }
                  : undefined
              }
            >
              {BASIN_LABELS[id]}
            </button>
          );
        })}
        {loading ? (
          <span className="ml-auto px-2 text-[11px] text-[var(--ink-4)]">
            Loading…
          </span>
        ) : (
          <a
            href="https://www.nhc.noaa.gov/"
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto inline-flex items-center gap-1 px-2 text-[11px] text-[var(--ink-4)] hover:text-[var(--ink-2)]"
          >
            NHC <ExternalLink className="h-3 w-3" strokeWidth={1.8} />
          </a>
        )}
      </div>

      <div
        className="flex flex-wrap gap-1.5 rounded-xl border border-[var(--line-default)] px-2 py-2 backdrop-blur-[28px]"
        style={{ background: 'var(--glass-hi)' }}
      >
        {TROPICAL_PRODUCTS.map((p) => {
          const active = product === p.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onProductChange(p.id)}
              className={`rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition-all duration-[var(--t-fast)] ${
                active
                  ? 'text-black'
                  : 'text-[var(--ink-3)] hover:bg-white/5 hover:text-[var(--ink-1)]'
              }`}
              style={
                active
                  ? {
                      background: 'var(--accent)',
                      boxShadow: '0 0 12px var(--accent-glow)',
                    }
                  : undefined
              }
              title={p.label}
            >
              {p.short}
            </button>
          );
        })}
      </div>
    </motion.div>
  );
}
