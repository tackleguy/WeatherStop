import {
  MODEL_GROUP_LABELS,
  WEATHER_MODELS,
  type ModelGroup,
  type ModelId,
} from '../../constants/models';

const GROUP_ORDER: ModelGroup[] = [
  'noaa',
  'ecmwf',
  'dwd',
  'canada',
  'france',
  'uk',
  'japan',
  'korea',
  'china',
  'australia',
  'nordic',
  'netherlands',
  'denmark',
  'switzerland',
  'italy',
];

interface Props {
  selected: ModelId[];
  onChange: (ids: ModelId[]) => void;
  max?: number;
}

export function ModelPicker({ selected, onChange, max = 6 }: Props) {
  const set = new Set(selected);

  function toggle(id: ModelId) {
    if (set.has(id)) {
      onChange(selected.filter((x) => x !== id));
      return;
    }
    if (selected.length >= max) {
      onChange([...selected.slice(1), id]);
      return;
    }
    onChange([...selected, id]);
  }

  return (
    <div
      className="flex max-h-64 flex-col overflow-hidden rounded-xl border border-[var(--line-default)] backdrop-blur-[28px] sm:max-h-[calc(100dvh-12rem)]"
      style={{ background: 'var(--glass-hi)' }}
    >
      <div className="flex items-center justify-between gap-2 border-b border-[var(--line-subtle)] px-3 py-2">
        <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--ink-4)]">
          Models ({WEATHER_MODELS.length})
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="text-[10px] font-semibold text-[var(--accent-2)] hover:underline"
            onClick={() =>
              onChange(
                WEATHER_MODELS.filter((m) => m.defaultSelected).map((m) => m.id),
              )
            }
          >
            Defaults
          </button>
          <button
            type="button"
            className="text-[10px] font-semibold text-[var(--ink-4)] hover:underline"
            onClick={() => onChange([])}
          >
            Clear
          </button>
          <span className="text-[11px] text-[var(--ink-3)]">
            {selected.length}/{max}
          </span>
        </div>
      </div>
      <div className="overflow-y-auto px-2 py-2">
        {GROUP_ORDER.map((group) => {
          const items = WEATHER_MODELS.filter((m) => m.group === group);
          if (items.length === 0) return null;
          return (
            <div key={group} className="mb-3">
              <div className="sticky top-0 z-10 mb-1 bg-[rgba(20,28,50,0.92)] px-1 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--ink-4)]">
                {MODEL_GROUP_LABELS[group]}
              </div>
              <ul className="space-y-0.5">
                {items.map((m) => {
                  const on = set.has(m.id);
                  return (
                    <li key={m.id}>
                      <button
                        type="button"
                        onClick={() => toggle(m.id)}
                        title={`${m.label} · ${m.region} · ${m.resolution} · ${m.horizon}`}
                        className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors ${
                          on
                            ? 'bg-white/10 text-[var(--ink-1)]'
                            : 'text-[var(--ink-3)] hover:bg-white/5 hover:text-[var(--ink-1)]'
                        }`}
                      >
                        <span
                          className={`grid h-4 w-4 shrink-0 place-items-center rounded border text-[9px] font-bold ${
                            on
                              ? 'border-[var(--accent)] bg-[var(--accent)] text-black'
                              : 'border-[var(--line-default)]'
                          }`}
                        >
                          {on ? '✓' : ''}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[12px] font-semibold">
                            {m.label}
                          </span>
                          <span className="block truncate text-[10px] text-[var(--ink-4)]">
                            {m.region} · {m.resolution} · {m.horizon}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
