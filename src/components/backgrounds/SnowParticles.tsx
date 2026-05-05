import { useMemo } from 'react';

const COUNT = 55;

interface Flake {
  left: number;
  size: number;
  delay: number;
  duration: number;
  opacity: number;
}

export function SnowParticles() {
  const flakes = useMemo<Flake[]>(
    () =>
      Array.from({ length: COUNT }, () => ({
        left: Math.random() * 100,
        size: 3 + Math.random() * 4,
        delay: -Math.random() * 8,
        duration: 5 + Math.random() * 6,
        opacity: 0.55 + Math.random() * 0.4,
      })),
    [],
  );

  return (
    <div className="pointer-events-none fixed inset-0 -z-[6] overflow-hidden">
      {flakes.map((f, i) => (
        <span
          key={i}
          className="absolute block rounded-full bg-white"
          style={{
            left: `${f.left}%`,
            top: '-5%',
            width: f.size,
            height: f.size,
            opacity: f.opacity,
            animation: `snowfall ${f.duration}s linear ${f.delay}s infinite`,
          }}
        />
      ))}
    </div>
  );
}
