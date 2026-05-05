import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import type { WeatherAlert } from '../types';

interface Props {
  alerts: WeatherAlert[];
}

const SEVERE = new Set(['Severe', 'Extreme']);

export function AlertsBanner({ alerts }: Props) {
  const severe = alerts.filter((a) => SEVERE.has(a.severity));
  const [expanded, setExpanded] = useState(false);
  if (severe.length === 0) return null;

  const primary = severe[0];

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="rounded-2xl border border-red-400/40 bg-red-500/25 px-4 py-3 backdrop-blur-xl"
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-2 text-left"
      >
        <AlertTriangle className="h-4 w-4 shrink-0 text-red-100" strokeWidth={2.4} />
        <div className="flex-1">
          <div className="text-[13px] font-semibold text-white">
            {primary.event}
            {severe.length > 1 ? ` · +${severe.length - 1} more` : ''}
          </div>
          <div className="line-clamp-1 text-[12px] text-red-50/85">
            {primary.headline}
          </div>
        </div>
        <ChevronDown
          className={`h-4 w-4 text-red-100 transition-transform ${expanded ? 'rotate-180' : ''}`}
        />
      </button>
      <AnimatePresence initial={false}>
        {expanded ? (
          <motion.div
            key="body"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="mt-3 space-y-3 text-[13px] text-red-50/90">
              {severe.map((a) => (
                <div key={a.id} className="border-t border-red-300/25 pt-2 first:border-0 first:pt-0">
                  <div className="font-semibold text-white">{a.event}</div>
                  <div className="mb-1 text-[11px] text-red-100/80">{a.areaDesc}</div>
                  <p className="whitespace-pre-line">{a.description}</p>
                </div>
              ))}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.div>
  );
}
