import type { HTMLAttributes, ReactNode } from 'react';

interface Props extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'high';
  children: ReactNode;
}

export function GlassPanel({
  variant = 'default',
  className = '',
  children,
  ...rest
}: Props) {
  const bg = variant === 'high' ? 'var(--glass-hi)' : 'var(--glass)';
  return (
    <div
      className={`rounded-xl border border-[var(--line-default)] backdrop-blur-[28px] ${className}`}
      style={{ background: bg }}
      {...rest}
    >
      {children}
    </div>
  );
}
