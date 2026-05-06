// Hover/focus tooltip. Position via CSS (left side rail uses 'right'),
// no portals — keeps zero-dep simplicity. Uses CSS data-state visibility
// rather than React state to avoid extra re-renders during hovers.

import type { ReactNode } from 'react';

interface Props {
  content: ReactNode;
  side?: 'right' | 'left' | 'top' | 'bottom';
  children: ReactNode;
}

const sideClasses: Record<NonNullable<Props['side']>, string> = {
  right:
    'left-full top-1/2 -translate-y-1/2 ml-2 origin-left',
  left: 'right-full top-1/2 -translate-y-1/2 mr-2 origin-right',
  top: 'bottom-full left-1/2 -translate-x-1/2 mb-2 origin-bottom',
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-2 origin-top',
};

export function Tooltip({ content, side = 'right', children }: Props) {
  return (
    <div className="group relative">
      {children}
      <div
        role="tooltip"
        className={`pointer-events-none absolute z-50 max-w-[220px] scale-95 rounded-md border border-[var(--line-default)] bg-[var(--glass-hi)] px-2.5 py-1.5 text-[12px] leading-snug text-[var(--ink-1)] opacity-0 backdrop-blur-md shadow-lg transition-all duration-[var(--t-fast)] group-hover:scale-100 group-hover:opacity-100 group-focus-within:scale-100 group-focus-within:opacity-100 ${sideClasses[side]}`}
        style={{ whiteSpace: 'nowrap' }}
      >
        {content}
      </div>
    </div>
  );
}
