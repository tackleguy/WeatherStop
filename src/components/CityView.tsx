import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { AlertsBanner } from './AlertsBanner';
import { HeroCard } from './HeroCard';
import { Meteogram } from './Meteogram';
import { DailyForecast } from './DailyForecast';
import { AirQualityCard } from './AirQualityCard';
import { UVIndexCard } from './UVIndexCard';
import { SunCard } from './SunCard';
import { WindCard } from './WindCard';
import { PrecipitationCard } from './PrecipitationCard';
import { DetailsGrid } from './DetailsGrid';
import { ComfortCard } from './ComfortCard';
import { PressureTrendCard } from './PressureTrendCard';
import { MoonCard } from './MoonCard';
import { TideCard } from './TideCard';
import { useWeather } from '../hooks/useWeather';
import { useTides } from '../hooks/useTides';
import { relativeTimeShort } from '../lib/format';
import type { City, Settings, WeatherSnapshot } from '../types';

interface Props {
  city: City;
  settings: Settings;
  onSnapshot: (snapshot: WeatherSnapshot | undefined) => void;
}

function SkeletonCard({ heightClass = 'h-32' }: { heightClass?: string }) {
  return <div className={`glass rounded-3xl ${heightClass} shimmer`} />;
}

function ErrorState({
  cityName,
  onRetry,
}: {
  cityName: string;
  onRetry: () => void;
}) {
  return (
    <div className="glass mx-4 mt-8 flex flex-col items-center gap-3 rounded-3xl p-6 text-center">
      <p className="text-base font-medium text-white">
        Couldn’t load weather for {cityName}.
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="rounded-full bg-white/20 px-4 py-1.5 text-sm font-medium text-white hover:bg-white/30"
      >
        Retry
      </button>
    </div>
  );
}

export function CityView({ city, settings, onSnapshot }: Props) {
  const { data, error, refresh } = useWeather(city);
  const tides = useTides(city);
  const [, setNow] = useState(Date.now());

  useEffect(() => {
    onSnapshot(data);
  }, [data, onSnapshot]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  if (error && !data) return <ErrorState cityName={city.name} onRetry={refresh} />;

  if (!data) {
    return (
      <div className="flex flex-col gap-3 px-4 pb-10 sm:px-6">
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
      </div>
    );
  }

  const w = data.data;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="flex flex-col gap-3 px-4 pb-10 sm:px-6"
    >
      {data.alerts && data.alerts.length > 0 ? (
        <AlertsBanner alerts={data.alerts} />
      ) : null}
      <HeroCard data={w} settings={settings} isCurrent={city.isCurrent} />
      <Meteogram data={w} settings={settings} index={0} />
      <DailyForecast data={w} settings={settings} index={1} />
      <ComfortCard data={w} settings={settings} index={2} />
      <PrecipitationCard data={w} index={3} />
      <AirQualityCard data={data.airQuality} index={4} />
      <UVIndexCard data={w} index={5} />
      <div className="grid grid-cols-2 gap-3">
        <SunCard data={w} index={6} />
        <WindCard data={w} settings={settings} index={7} />
      </div>
      <PressureTrendCard data={w} index={8} />
      {tides.station ? (
        <TideCard
          station={tides.station}
          events={tides.events}
          loading={tides.loading}
          index={9}
        />
      ) : null}
      <MoonCard index={tides.station ? 10 : 9} />
      <DetailsGrid data={w} settings={settings} index={tides.station ? 11 : 10} />

      <div className="pt-2 text-center text-[11px] text-white/55">
        Updated {relativeTimeShort(w.fetchedAt)}
        <span className="mx-2">·</span>
        <button
          type="button"
          onClick={refresh}
          className="underline-offset-2 hover:underline"
        >
          Refresh
        </button>
      </div>
    </motion.div>
  );
}
