import { useRadarStore } from '../../store/useRadarStore';
import { getProduct } from '../../constants/products';
import { DBZ_STOPS, KTS_STOPS } from '../../lib/colorTables';

export function RadarLegend() {
  const activeProduct = useRadarStore((s) => s.activeProduct);
  const product = getProduct(activeProduct);
  if (product.legend === 'none') return null;

  const stops =
    product.legend === 'dbz'
      ? DBZ_STOPS
      : product.legend === 'kts'
        ? KTS_STOPS
        : null;

  return (
    <div
      className="absolute bottom-[88px] right-4 z-10 w-[124px] rounded-xl border border-[var(--line-default)] p-3 backdrop-blur-[20px]"
      style={{ background: 'var(--glass)' }}
    >
      <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--ink-2)]">
        {product.legend === 'dbz'
          ? 'Reflectivity (dBZ)'
          : product.legend === 'kts'
            ? 'Velocity (kts)'
            : product.legend === 'satellite'
              ? 'Satellite'
              : product.legend === 'temp'
                ? 'Temperature'
                : product.label}
      </div>
      {stops ? (
        <div className="space-y-0.5">
          {stops
            .slice()
            .reverse()
            .map((s) => (
              <div key={s.dbz} className="flex items-center gap-2">
                <div
                  className="h-3 w-4 rounded-sm"
                  style={{ background: s.color }}
                />
                <span data-num className="text-[10px] text-[var(--ink-2)]">
                  {s.dbz}
                </span>
              </div>
            ))}
        </div>
      ) : (
        <div className="text-[11px] text-[var(--ink-3)]">
          {product.description}
        </div>
      )}
    </div>
  );
}
