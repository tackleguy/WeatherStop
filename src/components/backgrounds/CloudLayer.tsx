import { useMemo, type CSSProperties } from 'react';

interface Props {
  density: 'low' | 'medium' | 'high';
  tint: 'light' | 'dark';
}

export function CloudLayer({ density, tint }: Props) {
  const count = density === 'low' ? 4 : density === 'medium' ? 6 : 9;
  const fill =
    tint === 'light' ? 'rgba(255,255,255,0.7)' : 'rgba(226,232,240,0.45)';
  const stroke =
    tint === 'light' ? 'rgba(255,255,255,0.25)' : 'rgba(15,23,42,0.18)';

  // Deterministic placement so density changes don't reshuffle clouds.
  const clouds = useMemo(
    () =>
      Array.from({ length: count }).map((_, i) => ({
        top: ((i * 17 + 13) % 75) + 2,
        left: ((i * 31 + 7) % 100) - 10,
        scale: 0.75 + ((i * 13) % 60) / 100,
        blur: 2 + (i % 3) * 3,
        drift: 60 + (i % 4) * 25,
        delay: -((i * 7) % 60),
        variant: i % 3,
      })),
    [count],
  );

  return (
    <div className="pointer-events-none fixed inset-0 -z-[5] overflow-hidden">
      {clouds.map((c, i) => (
        <svg
          key={i}
          className="absolute"
          style={
            {
              top: `${c.top}%`,
              left: `${c.left}%`,
              '--s': c.scale,
              transform: `scale(${c.scale})`,
              filter: `blur(${c.blur}px)`,
              animation: `cloud-drift-${c.variant} ${c.drift}s ease-in-out ${c.delay}s infinite`,
            } as CSSProperties
          }
          width="320"
          height="100"
          viewBox="0 0 320 100"
        >
          <ellipse
            cx="70"
            cy="60"
            rx="60"
            ry="26"
            fill={fill}
            stroke={stroke}
            strokeWidth="1"
          />
          <ellipse
            cx="120"
            cy="48"
            rx="55"
            ry="32"
            fill={fill}
            stroke={stroke}
            strokeWidth="1"
          />
          <ellipse
            cx="180"
            cy="55"
            rx="65"
            ry="28"
            fill={fill}
            stroke={stroke}
            strokeWidth="1"
          />
          <ellipse
            cx="240"
            cy="62"
            rx="50"
            ry="22"
            fill={fill}
            stroke={stroke}
            strokeWidth="1"
          />
        </svg>
      ))}
    </div>
  );
}
