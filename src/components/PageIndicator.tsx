import { MapPin } from 'lucide-react';

interface Props {
  count: number;
  active: number;
  hasCurrent: boolean;
  onSelect: (index: number) => void;
}

export function PageIndicator({ count, active, hasCurrent, onSelect }: Props) {
  if (count <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-1.5 py-2">
      {Array.from({ length: count }, (_, i) => {
        const isActive = i === active;
        if (i === 0 && hasCurrent) {
          return (
            <button
              key={i}
              type="button"
              aria-label="Current location"
              onClick={() => onSelect(i)}
              className={`flex h-2.5 w-2.5 items-center justify-center transition-opacity ${
                isActive ? 'opacity-100' : 'opacity-40 hover:opacity-70'
              }`}
            >
              <MapPin className="h-2.5 w-2.5 text-white" strokeWidth={3} />
            </button>
          );
        }
        return (
          <button
            key={i}
            type="button"
            aria-label={`Go to city ${i + 1}`}
            onClick={() => onSelect(i)}
            className={`h-1.5 w-1.5 rounded-full bg-white transition-opacity ${
              isActive ? 'opacity-100' : 'opacity-40 hover:opacity-70'
            }`}
          />
        );
      })}
    </div>
  );
}
