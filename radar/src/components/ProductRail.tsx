import { useState } from 'react';
import { PRODUCTS, type ProductId } from '../constants/products';

interface Props {
  active: ProductId;
  onSelect: (id: ProductId) => void;
}

// Collapsed at 56px, expands to 200px when hovered/focused. Each row is
// a reasonable click target (44px tall). Disabled products render
// muted with no click handler.
export function ProductRail({ active, onSelect }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <nav
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      style={{
        background: 'rgba(15,18,23,0.92)',
        border: '1px solid rgba(255,255,255,0.08)',
      }}
      className={`flex flex-col gap-0.5 rounded-xl py-2 backdrop-blur-md transition-[width] duration-200 ${
        open ? 'w-[200px]' : 'w-14'
      }`}
    >
      {PRODUCTS.map(({ id, label, icon: Icon, disabled }) => {
        const isActive = id === active;
        return (
          <button
            key={id}
            type="button"
            disabled={disabled}
            title={disabled ? `${label} (coming soon)` : label}
            aria-label={label}
            onClick={() => !disabled && onSelect(id)}
            className={`flex h-11 items-center gap-3 px-3 transition-colors ${
              disabled
                ? 'cursor-not-allowed text-white/30'
                : isActive
                  ? 'bg-white text-black'
                  : 'text-white/55 hover:bg-white/8 hover:text-white'
            } ${open ? '' : 'justify-center'} ${
              isActive ? '' : 'rounded-md'
            }`}
          >
            <Icon className="h-5 w-5 shrink-0" strokeWidth={1.6} />
            <span
              className={`whitespace-nowrap text-[13px] font-medium ${
                open ? 'opacity-100' : 'pointer-events-none opacity-0'
              } transition-opacity`}
            >
              {label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
