import type { ButtonHTMLAttributes } from 'react';
import type { LucideIcon } from 'lucide-react';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: LucideIcon;
}

export function IconButton({ icon: Icon, className = '', ...rest }: Props) {
  return (
    <button
      type="button"
      className={`control-button ${className}`}
      {...rest}
    >
      <Icon className="h-4 w-4" strokeWidth={1.6} />
    </button>
  );
}
