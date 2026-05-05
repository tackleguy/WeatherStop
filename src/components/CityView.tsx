import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { AlertsBanner } from './AlertsBanner';
import { HeroCard } from './HeroCard';
import { HourlyStrip } from './HourlyStrip';
import { DailyForecast } from './DailyForecast';
import { AirQualityCard } from './AirQualityCard';
import { UVIndexCard } from './UVIndexCard';
import { SunCard } from './SunCard';
import { WindCard } from './WindCard';
import { PrecipitationCard } from './PrecipitationCard';
import { DetailsGrid } from './DetailsGrid';
import { useWeather } from '../hooks/useWeather';
import { relativeTimeShort } from '../lib/format';
import type { City, Settings, WeatherBundle } from '../types';

interface Props {
  city: City;
  settings: Settings;
  onWeather: (bundle: WeatherBundle | undefined) => void;
}

function SkeletonCard({ heightClass = 'h-32' }: { heightClass?: string }) {
  return <div className={`glass rounded-3xl ${heightClass} shimmer`} />;
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="glass mt-8 flex flex-col items-center gap-3 rounded-3xl p-6 text-center">
      <p className="text-base font-medium text-white">Couldn’t load weather</p>
      <button
        type="button"
        onClick={onRetry}
        className="rounded-full bg-white/20 px-4 py-1.5 text-sm font-medium text-white hover:bg-white/30"
      >
        Try again
      </button>
    </div>
  );
}

export function CityView({ city, settings, onWeather }: Props) {
  const { data, loading, error, refresh } = useWeather(city, settings);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    onWeather(data);
  }, [data, onWeather]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  if (error && !data) return <ErrorState onRetry={refresh} />;

  if (!data) {
    return (
      <div className="flex flex-col gap-3 px-4 pb-10">
        <div className="flex flex-col items-center pt-6 pb-2">
          <div className="mt-2 h-8 w-40 rounded-full bg-white/10 shimmer" />
          <div className="mt-3 h-24 w-32 rounded-2xl bg-white/10 shimmer" />
          <div className="mt-3 h-5 w-44 rounded-full bg-white/10 shimmer" />
        </div>
        <SkeletonCard />
        <SkeletonCard heightClass="h-48" />
        <div className="grid grid-cols-2 gap-3">
          <SkeletonCard heightClass="h-28" />
          <SkeletonCard heightClass="h-28" />
        </div>
        {loading ? null : null}
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="flex flex-col gap-3 px-4 pb-10"
    >
      {data.alerts && data.alerts.length > 0 ? (
        <AlertsBanner alerts={data.alerts} />
      ) : null}
      <HeroCard city={city} data={data.forecast} />
      <HourlyStrip data={data.forecast} index={0} />
      <DailyForecast data={data.forecast} index={1} />
      <AirQualityCard data={data.airQuality} index={2} />
      <UVIndexCard data={data.forecast} index={3} />
      <div className="grid grid-cols-2 gap-3">
        <SunCard data={data.forecast} index={4} />
        <WindCard data={data.forecast} settings={settings} index={5} />
      </div>
      <PrecipitationCard data={data.forecast} settings={settings} index={6} />
      <DetailsGrid data={data.forecast} settings={settings} index={7} />

      <div className="pt-2 text-center text-[11px] text-white/55">
        Updated {relativeTimeShort(data.fetchedAt)}
        <span className="mx-2">·</span>
        <button
          type="button"
          onClick={refresh}
          className="underline-offset-2 hover:underline"
        >
          Refresh
        </button>
        <span className="hidden">{now}</span>
      </div>
    </motion.div>
  );
}
