import { PRODUCTS, type ProductId } from '../constants/products';

interface Props {
  active: ProductId;
  onSelect: (id: ProductId) => void;
}

export function ProductRail({ active, onSelect }: Props) {
  return (
    <nav className="glass flex h-full w-16 flex-col items-center gap-1 rounded-2xl py-3">
      {PRODUCTS.map(({ id, label, short, icon: Icon }) => {
        const isActive = id === active;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onSelect(id)}
            title={label}
            aria-label={label}
            className={`group flex w-12 flex-col items-center gap-1 rounded-xl px-1 py-2 transition-colors ${
              isActive
                ? 'bg-white/15 text-white'
                : 'text-white/60 hover:bg-white/8 hover:text-white/90'
            }`}
          >
            <Icon className="h-5 w-5" strokeWidth={1.6} />
            <span className="text-[9px] font-semibold tracking-wider">
              {short}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
