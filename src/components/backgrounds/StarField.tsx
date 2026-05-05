import { useMemo } from 'react';

const COUNT = 80;

interface Star {
  x: number;
  y: number;
  size: number;
  delay: number;
  duration: number;
}

export function StarField() {
  const stars = useMemo<Star[]>(
    () =>
      Array.from({ length: COUNT }, () => ({
        x: Math.random() * 100,
        y: Math.random() * 70,
        size: Math.random() < 0.7 ? 1 : 2,
        delay: -Math.random() * 3,
        duration: 2 + Math.random() * 3,
      })),
    [],
  );

  return (
    <div className="pointer-events-none fixed inset-0 -z-[6] overflow-hidden">
      {stars.map((s, i) => (
        <span
          key={i}
          className="absolute block rounded-full bg-white"
          style={{
            left: `${s.x}%`,
            top: `${s.y}%`,
            width: s.size,
            height: s.size,
            animation: `twinkle ${s.duration}s ease-in-out ${s.delay}s infinite`,
          }}
        />
      ))}
    </div>
  );
}
