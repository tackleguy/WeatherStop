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
      className="pointer-events-auto absolute left-3 right-3 top-3 z-20 flex max-h-[46%] flex-col gap-2 overflow-y-auto sm:left-3 sm:right-auto sm:max-w-[42rem]"
    >
      <div className="floating-panel px-3 py-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div>
            <p className="section-eyebrow">SPC outlooks</p>
            <p className="text-[12px] text-[var(--ink-3)]">
              Keep the map dominant while switching domains, days, and products.
            </p>
          </div>
          {loading ? (
            <span className="px-2 text-[11px] text-[var(--ink-4)]">Loading…</span>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
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
              className="chip-button"
              data-active={active}
            >
              {label}
            </button>
          );
        })}
        </div>
      </div>

      <div className="floating-subpanel px-3 py-3">
        <p className="section-eyebrow mb-2">Day</p>
        <div className="flex flex-wrap gap-2">
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
                className="chip-button"
                data-active={active}
              >
                Day {d}
              </button>
            );
          })}
        </div>
      </div>

      <div className="floating-subpanel px-3 py-3">
        <p className="section-eyebrow mb-2">Product</p>
        <div className="flex flex-wrap gap-2">
          {products.map((p) => {
            const active = product === p.id;
            return (
              <button
                key={p.id}
                type="button"
                title={p.label}
                onClick={() => onProductChange(p.id)}
                className="chip-button"
                data-active={active}
              >
                <span className="sm:hidden">{p.short}</span>
                <span className="hidden sm:inline">{p.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
