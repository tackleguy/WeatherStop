import { useMemo } from 'react';

interface Props {
  count?: number;
}

export function StarField({ count = 80 }: Props) {
  const stars = useMemo(
    () =>
      Array.from({ length: count }).map(() => ({
        top: Math.random() * 100,
        left: Math.random() * 100,
        size: 1 + Math.random() * 1.5,
        delay: Math.random() * 4,
        baseOpacity: 0.4 + Math.random() * 0.5,
      })),
    [count],
  );

  return (
    <div className="pointer-events-none fixed inset-0 -z-[6]">
      {stars.map((s, i) => (
        <div
          key={i}
          className="absolute rounded-full bg-white"
          style={{
            top: `${s.top}%`,
            left: `${s.left}%`,
            width: `${s.size}px`,
            height: `${s.size}px`,
            opacity: s.baseOpacity,
            animation: `twinkle 3.5s ease-in-out ${s.delay}s infinite`,
          }}
        />
      ))}
    </div>
  );
}
