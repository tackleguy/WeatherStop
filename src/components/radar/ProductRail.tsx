import { PRODUCTS } from '../../constants/products';
import { useRadarStore } from '../../store/useRadarStore';
import { Tooltip } from '../ui/Tooltip';

export function ProductRail() {
  const activeProduct = useRadarStore((s) => s.activeProduct);
  const setActiveProduct = useRadarStore((s) => s.setActiveProduct);
  const mapZoom = useRadarStore((s) => s.mapZoom);

  return (
    <aside
      className="relative z-10 flex w-14 shrink-0 flex-col items-center gap-1 border-r border-[var(--line-subtle)] py-3 backdrop-blur-[28px]"
      style={{ background: 'var(--glass)' }}
    >
      {PRODUCTS.map((p) => {
        const Icon = p.icon;
        const disabled =
          p.requiresZoom !== undefined && mapZoom < p.requiresZoom;
        const active = activeProduct === p.id;

        return (
          <Tooltip
            key={p.id}
            side="right"
            content={
              <div className="space-y-0.5 text-left whitespace-normal">
                <div className="font-semibold">{p.label}</div>
                <div className="text-[11px] text-[var(--ink-3)]">
                  {p.description}
                </div>
                {p.requiresZoom !== undefined && mapZoom < p.requiresZoom ? (
                  <div className="text-[11px] text-[var(--accent-2)]">
                    Zoom in to ≥ {p.requiresZoom}
                  </div>
                ) : null}
              </div>
            }
          >
            <button
              type="button"
              onClick={() => !disabled && setActiveProduct(p.id)}
              disabled={disabled}
              aria-label={p.label}
              className={`grid h-10 w-10 place-items-center rounded-lg transition-all duration-[var(--t-fast)] ease-[var(--ease)] ${
                active
                  ? 'text-black'
                  : 'text-[var(--ink-3)] hover:bg-white/5 hover:text-[var(--ink-1)]'
              } ${disabled ? 'cursor-not-allowed opacity-30' : ''}`}
              style={
                active
                  ? {
                      background: 'var(--accent)',
                      boxShadow: '0 0 12px var(--accent-glow)',
                    }
                  : undefined
              }
            >
              <Icon
                className="h-[18px] w-[18px]"
                strokeWidth={active ? 2.2 : 1.6}
              />
            </button>
          </Tooltip>
        );
      })}
    </aside>
  );
}
