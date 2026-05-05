import { AnimatePresence, motion, type Variants } from 'framer-motion';
import { useEffect, useRef, type ReactNode } from 'react';
import type { City } from '../types';

interface Props {
  cities: City[];
  active: number;
  onChange: (next: number) => void;
  renderCity: (city: City, index: number) => ReactNode;
}

const SWIPE_THRESHOLD = 80;

const variants: Variants = {
  enter: { opacity: 0, y: 8 },
  center: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

export function CityCarousel({ cities, active, onChange, renderCity }: Props) {
  const direction = useRef(0);

  useEffect(() => {
    if (active >= cities.length && cities.length > 0) {
      onChange(cities.length - 1);
    }
  }, [active, cities.length, onChange]);

  if (cities.length === 0) return null;
  const current = cities[Math.min(active, cities.length - 1)];

  return (
    <div className="relative">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={current.id}
          variants={variants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.25, ease: 'easeOut' }}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.2}
          onDragEnd={(_, info) => {
            if (info.offset.x < -SWIPE_THRESHOLD && active < cities.length - 1) {
              direction.current = 1;
              onChange(active + 1);
            } else if (info.offset.x > SWIPE_THRESHOLD && active > 0) {
              direction.current = -1;
              onChange(active - 1);
            }
          }}
        >
          {renderCity(current, active)}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
