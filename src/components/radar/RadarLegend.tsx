import { useRadarStore } from '../../store/useRadarStore';
import { getProduct } from '../../constants/products';
import {
  DBZ_STOPS,
  KTS_STOPS,
  RHO_STOPS,
  WIND_STOPS,
  TEMP_STOPS,
} from '../../lib/colorTables';

interface SwatchRow {
  color: string;
  label: string;
}

export function RadarLegend() {
  const activeProduct = useRadarStore((s) => s.activeProduct);
  const product = getProduct(activeProduct);
  if (product.legend === 'none') return null;

  const rows: SwatchRow[] | null = (() => {
    if (product.legend === 'dbz') {
      return DBZ_STOPS.slice()
        .reverse()
        .map((s) => ({ color: s.color, label: `${s.dbz}` }));
    }
    if (product.legend === 'kts') {
      return KTS_STOPS.slice()
        .reverse()
        .map((s) => ({ color: s.color, label: `${s.dbz}` }));
    }
    if (product.legend === 'rho') {
      return RHO_STOPS.slice()
        .reverse()
        .map((s) => ({
          color: s.color,
          label: `${s.rho.toFixed(2)} · ${s.label}`,
        }));
    }
    if (product.legend === 'wind') {
      return WIND_STOPS.slice()
        .reverse()
        .map((s) => ({ color: s.color, label: `${s.value} mph` }));
    }
    if (product.legend === 'temp') {
      return TEMP_STOPS.slice()
        .reverse()
        .map((s) => ({ color: s.color, label: `${s.value}°F` }));
    }
    return null;
  })();

  const title =
    product.legend === 'dbz'
      ? 'Reflectivity (dBZ)'
      : product.legend === 'kts'
        ? 'Velocity (kts)'
        : product.legend === 'rho'
          ? 'Correlation (ρ)'
          : product.legend === 'wind'
            ? 'Wind (mph)'
            : product.legend === 'temp'
              ? 'Temperature (°F)'
              : product.legend === 'satellite'
                ? 'Satellite'
                : product.label;

  return (
    <div
      className="radar-legend absolute bottom-[88px] right-4 z-10 w-[148px] rounded-xl border border-[var(--line-default)] p-3 backdrop-blur-[20px]"
      style={{ background: 'var(--glass)' }}
    >
      <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--ink-2)]">
        {title}
      </div>
      {rows ? (
        <div className="space-y-0.5">
          {rows.map((row) => (
            <div key={`${row.color}-${row.label}`} className="flex items-center gap-2">
              <div
                className="pixelated h-3 w-4 rounded-sm"
                style={{ background: row.color }}
              />
              <span data-num className="text-[10px] text-[var(--ink-2)]">
                {row.label}
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
