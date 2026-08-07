import {
  getTropicalProduct,
  type TropicalProduct,
} from '../../lib/nhcTropical';

interface Props {
  product: TropicalProduct;
}

export function TropicalLegend({ product }: Props) {
  const def = getTropicalProduct(product);

  const rows =
    product === 'watches'
      ? [
          { label: 'Hurricane Warning', color: '#ff3b30' },
          { label: 'Tropical Watch', color: '#ff9500' },
          { label: 'Other', color: '#ffcc00' },
        ]
      : product === 'gtwo7'
        ? [
            { label: 'High risk', color: '#ff3b30' },
            { label: 'Medium risk', color: '#ff9500' },
            { label: 'Low risk', color: '#ffcc00' },
          ]
        : product.startsWith('prob')
          ? [{ label: def.label, color: product === 'prob34' ? '#3b9eff' : product === 'prob50' ? '#34c759' : '#af52de' }]
          : [{ label: def.label, color: '#3b9eff' }];

  return (
    <div
      className="pointer-events-none absolute bottom-4 right-3 z-20 rounded-xl border border-[var(--line-default)] px-3 py-2.5 backdrop-blur-[28px]"
      style={{ background: 'var(--glass-hi)' }}
    >
      <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--ink-4)]">
        {def.label}
      </div>
      <div className="space-y-1">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 rounded-sm"
              style={{ background: r.color }}
            />
            <span className="text-[11px] text-[var(--ink-2)]">{r.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
