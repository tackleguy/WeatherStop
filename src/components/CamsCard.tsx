// Nearby webcams card. Renders a horizontal scroll strip of thumbnails
// for the active city. Each thumbnail is a click-to-open link to the
// upstream cam's player page (Windy's player URL). Empty state hides
// the card entirely.

import { Camera, ExternalLink } from 'lucide-react';
import { Card } from './Card';
import { useCams } from '../hooks/useCams';
import type { City } from '../types';

interface Props {
  city: City;
  index?: number;
}

export function CamsCard({ city, index }: Props) {
  const { cams, loading } = useCams(city.latitude, city.longitude, 60);

  if (!loading && cams.length === 0) return null;

  return (
    <Card
      title="Nearby Cams"
      icon={Camera}
      index={index}
      meta={loading ? 'Loading…' : `${cams.length} found`}
    >
      <div className="-mx-1 flex gap-2 overflow-x-auto no-scrollbar pb-1">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-24 w-40 shrink-0 rounded-lg shimmer"
              />
            ))
          : cams.slice(0, 12).map((c) => (
              <a
                key={c.id}
                href={c.playerUrl ?? c.previewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="group relative h-24 w-40 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-white/5"
                title={c.title}
              >
                {c.thumbnailUrl ? (
                  <img
                    src={c.thumbnailUrl}
                    alt={c.title}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div className="grid h-full w-full place-items-center text-[11px] text-white/45">
                    {c.title}
                  </div>
                )}
                <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-1.5">
                  <div className="flex items-center gap-1 text-[10px] font-semibold text-white">
                    <ExternalLink className="h-2.5 w-2.5" strokeWidth={2.4} />
                    <span className="truncate">{c.title}</span>
                  </div>
                  {typeof c.distanceKm === 'number' ? (
                    <div className="text-[9px] tabular text-white/65">
                      {Math.round(c.distanceKm)} km
                    </div>
                  ) : null}
                </div>
              </a>
            ))}
      </div>
    </Card>
  );
}
