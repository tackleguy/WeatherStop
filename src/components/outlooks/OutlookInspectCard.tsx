import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { OutlookFeatureProps } from '../../lib/spcOutlooks';

interface Props {
  feature: OutlookFeatureProps | null;
  onClose: () => void;
}

function formatSpcTime(raw?: string): string {
  if (!raw) return '—';
  // SPC often uses YYYYMMDDHHMM
  if (/^\d{12}$/.test(raw)) {
    const y = raw.slice(0, 4);
    const mo = raw.slice(4, 6);
    const d = raw.slice(6, 8);
    const h = raw.slice(8, 10);
    const mi = raw.slice(10, 12);
    return `${y}-${mo}-${d} ${h}:${mi}Z`;
  }
  return raw;
}

export function OutlookInspectCard({ feature, onClose }: Props) {
  return (
    <AnimatePresence>
      {feature ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.2 }}
          className="pointer-events-auto absolute bottom-4 right-3 z-20 w-[min(100%-1.5rem,280px)] rounded-xl border border-[var(--line-default)] px-3 py-3 backdrop-blur-[28px]"
          style={{ background: 'var(--glass-hi)' }}
        >
          <div className="mb-2 flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <span
                className="h-3.5 w-3.5 shrink-0 rounded-sm border border-black/20"
                style={{ background: feature.fill }}
              />
              <h2 className="text-[14px] font-semibold text-[var(--ink-1)]">
                {feature.label}
                {feature.label2 ? (
                  <span className="ml-1 font-normal text-[var(--ink-3)]">
                    {feature.label2}
                  </span>
                ) : null}
              </h2>
            </div>
            <button
              type="button"
              aria-label="Close"
              onClick={onClose}
              className="text-[var(--ink-4)] hover:text-[var(--ink-1)]"
            >
              <X className="h-4 w-4" strokeWidth={2} />
            </button>
          </div>
          <dl className="space-y-1 text-[11px]">
            <div className="flex justify-between gap-3">
              <dt className="text-[var(--ink-4)]">Valid</dt>
              <dd className="tabular text-[var(--ink-2)]">
                {formatSpcTime(feature.valid)}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-[var(--ink-4)]">Expires</dt>
              <dd className="tabular text-[var(--ink-2)]">
                {formatSpcTime(feature.expire)}
              </dd>
            </div>
            {feature.issue ? (
              <div className="flex justify-between gap-3">
                <dt className="text-[var(--ink-4)]">Issued</dt>
                <dd className="tabular text-[var(--ink-2)]">
                  {formatSpcTime(feature.issue)}
                </dd>
              </div>
            ) : null}
          </dl>
          <p className="mt-2 text-[10px] text-[var(--ink-4)]">
            Source: NOAA Storm Prediction Center
          </p>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
