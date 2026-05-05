import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import type { GradientName } from '../../lib/weatherCodes';
import { GRADIENTS } from '../../constants/gradients';
import { describe } from '../../lib/weatherCodes';
import { RainParticles } from './RainParticles';
import { SnowParticles } from './SnowParticles';
import { StarField } from './StarField';

interface Props {
  gradient: GradientName;
  weatherCode: number;
  isDay: boolean;
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(
    () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  useEffect(() => {
    if (typeof matchMedia === 'undefined') return;
    const mq = matchMedia('(prefers-reduced-motion: reduce)');
    const handler = () => setReduced(mq.matches);
    mq.addEventListener?.('change', handler);
    return () => mq.removeEventListener?.('change', handler);
  }, []);
  return reduced;
}

function LightningOverlay() {
  const [flashing, setFlashing] = useState(false);
  useEffect(() => {
    let raf: number;
    function schedule() {
      const wait = 5000 + Math.random() * 10_000;
      raf = window.setTimeout(() => {
        setFlashing(true);
        window.setTimeout(() => setFlashing(false), 200);
        schedule();
      }, wait) as unknown as number;
    }
    schedule();
    return () => window.clearTimeout(raf);
  }, []);
  return (
    <div
      className="pointer-events-none fixed inset-0 -z-[5] bg-white transition-opacity duration-[120ms]"
      style={{ opacity: flashing ? 0.55 : 0 }}
    />
  );
}

export function DynamicBackground({ gradient, weatherCode, isDay }: Props) {
  const reduced = useReducedMotion();
  const info = describe(weatherCode);

  return (
    <>
      <AnimatePresence mode="sync">
        <motion.div
          key={gradient}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.0 }}
          className={`fixed inset-0 -z-10 bg-gradient-to-b ${GRADIENTS[gradient]}`}
        />
      </AnimatePresence>

      {/* Subtle vignette so cards read against bright gradients */}
      <div
        className="pointer-events-none fixed inset-0 -z-[8] bg-gradient-to-b from-black/0 via-black/0 to-black/35"
        aria-hidden
      />

      {!reduced && info.group === 'thunderstorm' ? <LightningOverlay /> : null}

      {!reduced &&
      (info.group === 'rain' ||
        info.group === 'showers' ||
        info.group === 'drizzle' ||
        info.group === 'thunderstorm') ? (
        <RainParticles />
      ) : null}

      {!reduced && info.group === 'snow' ? <SnowParticles /> : null}

      {!reduced && !isDay && (info.group === 'clear' || info.group === 'partly_cloudy') ? (
        <StarField />
      ) : null}
    </>
  );
}
