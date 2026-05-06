import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import type { GradientName } from '../../lib/weatherCodes';
import { GRADIENTS, TOP_GLOW } from '../../constants/gradients';
import { AtmosphereGrain } from './AtmosphereGrain';
import { CloudLayer } from './CloudLayer';
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

function isRainCode(code: number): boolean {
  return (
    (code >= 51 && code <= 67) ||
    (code >= 80 && code <= 82) ||
    code === 95 ||
    code === 96 ||
    code === 99
  );
}

function isSnowCode(code: number): boolean {
  return (code >= 71 && code <= 77) || code === 85 || code === 86;
}

function isThunderCode(code: number): boolean {
  return code === 95 || code === 96 || code === 99;
}

export function DynamicBackground({ gradient, weatherCode, isDay }: Props) {
  const reduced = useReducedMotion();

  return (
    <>
      <AnimatePresence mode="sync">
        <motion.div
          key={gradient}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.2 }}
          className={`fixed inset-0 -z-10 bg-gradient-to-b ${GRADIENTS[gradient]}`}
        />
      </AnimatePresence>

      <AtmosphereGrain />

      {/* Tinted top-of-viewport halo so the area above the hero is never
          a flat band of color. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 -z-[7] h-[60vh]"
        style={{ background: TOP_GLOW[gradient] }}
      />

      {/* Subtle vignette to keep cards legible at the bottom of bright skies. */}
      <div
        className="pointer-events-none fixed inset-0 -z-[8] bg-gradient-to-b from-black/0 via-black/0 to-black/25"
        aria-hidden
      />

      {!reduced && !isDay && weatherCode <= 3 ? (
        <StarField count={weatherCode === 0 ? 160 : 100} />
      ) : null}

      {(weatherCode === 1 || weatherCode === 2) ? (
        <CloudLayer
          density={weatherCode === 1 ? 'low' : 'medium'}
          tint={isDay ? 'light' : 'dark'}
        />
      ) : null}
      {weatherCode === 3 ? (
        <CloudLayer density="high" tint={isDay ? 'light' : 'dark'} />
      ) : null}

      {!reduced && isThunderCode(weatherCode) ? <LightningOverlay /> : null}
      {!reduced && isRainCode(weatherCode) ? <RainParticles /> : null}
      {!reduced && isSnowCode(weatherCode) ? <SnowParticles /> : null}
    </>
  );
}
