import type { ButtonHTMLAttributes } from 'react';
import type { LucideIcon } from 'lucide-react';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: LucideIcon;
}

export function IconButton({ icon: Icon, className = '', ...rest }: Props) {
  return (
    <button
      type="button"
      className={`grid h-8 w-8 place-items-center rounded-lg text-[var(--ink-2)] transition-colors duration-[var(--t-fast)] hover:bg-white/5 hover:text-[var(--ink-1)] ${className}`}
      {...rest}
    >
      <Icon className="h-4 w-4" strokeWidth={1.6} />
    </button>
  );
}
