import { motion } from 'framer-motion';
import {
  defaultProduct,
  productsFor,
  type OutlookDay,
  type OutlookDomain,
  type OutlookProduct,
} from '../../lib/spcOutlooks';

const DAYS: OutlookDay[] = [1, 2, 3, 4, 5, 6, 7, 8];

interface Props {
  domain: OutlookDomain;
  day: OutlookDay;
  product: OutlookProduct;
  onDomainChange: (d: OutlookDomain) => void;
  onDayChange: (d: OutlookDay) => void;
  onProductChange: (p: OutlookProduct) => void;
  loading?: boolean;
}

export function OutlooksControls({
  domain,
  day,
  product,
  onDomainChange,
  onDayChange,
  onProductChange,
  loading,
}: Props) {
  const products = productsFor(domain, day);

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
        {(
          [
            ['convective', 'Convective'],
            ['fire', 'Fire Weather'],
          ] as const
        ).map(([id, label]) => {
          const active = domain === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => {
                onDomainChange(id);
                onProductChange(defaultProduct(id, day));
              }}
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
              {label}
            </button>
          );
        })}
        {loading ? (
          <span className="ml-auto px-2 text-[11px] text-[var(--ink-4)]">
            Loading…
          </span>
        ) : null}
      </div>

      <div
        className="flex flex-wrap items-center gap-1 rounded-xl border border-[var(--line-default)] px-2 py-2 backdrop-blur-[28px]"
        style={{ background: 'var(--glass-hi)' }}
      >
        <span className="px-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--ink-4)]">
          Day
        </span>
        {DAYS.map((d) => {
          const active = day === d;
          return (
            <button
              key={d}
              type="button"
              onClick={() => {
                onDayChange(d);
                const next = productsFor(domain, d);
                if (!next.some((p) => p.id === product)) {
                  onProductChange(next[0].id);
                }
              }}
              className={`rounded-md px-2.5 py-1 text-[12px] font-semibold transition-all duration-[var(--t-fast)] ${
                active
                  ? 'text-black'
                  : 'text-[var(--ink-3)] hover:bg-white/5 hover:text-[var(--ink-1)]'
              }`}
              style={
                active
                  ? {
                      background: 'var(--cool)',
                      boxShadow: '0 0 10px var(--cool-glow)',
                    }
                  : undefined
              }
            >
              {d}
            </button>
          );
        })}
      </div>

      <div
        className="flex flex-wrap items-center gap-1.5 rounded-xl border border-[var(--line-default)] px-2 py-2 backdrop-blur-[28px]"
        style={{ background: 'var(--glass-hi)' }}
      >
        <span className="px-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--ink-4)]">
          Product
        </span>
        {products.map((p) => {
          const active = product === p.id;
          return (
            <button
              key={p.id}
              type="button"
              title={p.label}
              onClick={() => onProductChange(p.id)}
              className={`rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition-all duration-[var(--t-fast)] sm:text-[12px] ${
                active
                  ? 'text-black'
                  : 'text-[var(--ink-3)] hover:bg-white/5 hover:text-[var(--ink-1)]'
              }`}
              style={
                active
                  ? {
                      background: '#a78bfa',
                      boxShadow: '0 0 12px rgba(167,139,250,0.4)',
                    }
                  : undefined
              }
            >
              <span className="sm:hidden">{p.short}</span>
              <span className="hidden sm:inline">{p.label}</span>
            </button>
          );
        })}
      </div>
    </motion.div>
  );
}
