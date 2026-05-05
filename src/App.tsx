import { Plus, Settings as SettingsIcon } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { CityCarousel } from './components/CityCarousel';
import { CitySearch } from './components/CitySearch';
import { CityView } from './components/CityView';
import { PageIndicator } from './components/PageIndicator';
import { SettingsSheet } from './components/SettingsSheet';
import { DynamicBackground } from './components/backgrounds/DynamicBackground';
import { INITIAL_SEED } from './constants/cities';
import { useCities } from './hooks/useCities';
import { useGeolocation } from './hooks/useGeolocation';
import { useSettings } from './hooks/useSettings';
import { localHourIn } from './lib/format';
import { gradientFor } from './lib/weatherCodes';
import { reverseGeocodeUS } from './lib/nws';
import type { City, WeatherBundle } from './types';

export default function App() {
  const { cities, add, remove, reorder, upsertCurrent } = useCities();
  const { settings, update } = useSettings();
  const geo = useGeolocation();

  const [active, setActive] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [activeBundle, setActiveBundle] = useState<WeatherBundle | undefined>();

  // Capture initial empty-state once so re-renders don't retrigger seeding.
  const bootstrapRan = useRef(false);
  const initiallyEmptyRef = useRef(cities.length === 0);

  useEffect(() => {
    if (bootstrapRan.current) return;
    bootstrapRan.current = true;

    (async () => {
      // 1. Seed default cities if this is a first-run user.
      if (initiallyEmptyRef.current) {
        for (const city of INITIAL_SEED) add(city);
      }

      // 2. Try to capture the device's current location and pin it first.
      const coords = await geo.request();
      if (!coords) return;

      // Resolve a pretty city name. NWS /points returns city/state for free
      // when we're in the US; otherwise fall back to a timezone-derived name.
      const us = await reverseGeocodeUS(coords.latitude, coords.longitude);
      const name = us?.city
        ? us.city
        : Intl.DateTimeFormat()
            .resolvedOptions()
            .timeZone.split('/')
            .pop()
            ?.replace(/_/g, ' ') || 'Current Location';

      const city: City = {
        id: 'current',
        name,
        region: us?.state,
        country: us ? 'United States' : undefined,
        countryCode: us ? 'US' : undefined,
        latitude: coords.latitude,
        longitude: coords.longitude,
        timezone: us?.timeZone,
        isCurrent: true,
      };
      upsertCurrent(city);
      setActive(0);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (active >= cities.length) setActive(Math.max(0, cities.length - 1));
  }, [active, cities.length]);

  const onWeather = useCallback((bundle: WeatherBundle | undefined) => {
    setActiveBundle(bundle);
  }, []);

  const renderCity = useCallback(
    (city: City) => (
      <CityView
        key={city.id}
        city={city}
        settings={settings}
        onWeather={onWeather}
      />
    ),
    [onWeather, settings],
  );

  const code = activeBundle?.forecast.current.weather_code ?? 1;
  const isDay = activeBundle?.forecast.current.is_day === 1;
  const localHour = localHourIn(activeBundle?.forecast.timezone, new Date());
  const gradient = gradientFor(code, isDay, localHour);

  const hasCurrent = cities.some((c) => c.isCurrent);

  return (
    <div className="relative mx-auto flex min-h-[100dvh] max-w-md flex-col">
      <DynamicBackground gradient={gradient} weatherCode={code} isDay={isDay} />

      <header className="flex items-center justify-between px-4 pt-4 pb-2 sm:px-6">
        <button
          type="button"
          aria-label="Open settings"
          onClick={() => setSettingsOpen(true)}
          className="grid h-9 w-9 place-items-center rounded-full bg-white/12 text-white backdrop-blur hover:bg-white/20"
        >
          <SettingsIcon className="h-4 w-4" strokeWidth={2.2} />
        </button>
        <PageIndicator
          count={cities.length}
          active={active}
          hasCurrent={hasCurrent}
          onSelect={setActive}
        />
        <button
          type="button"
          aria-label="Add city"
          onClick={() => setSearchOpen(true)}
          className="grid h-9 w-9 place-items-center rounded-full bg-white/12 text-white backdrop-blur hover:bg-white/20"
        >
          <Plus className="h-4 w-4" strokeWidth={2.5} />
        </button>
      </header>

      <main className="flex-1">
        {cities.length > 0 ? (
          <CityCarousel
            cities={cities}
            active={Math.min(active, cities.length - 1)}
            onChange={setActive}
            renderCity={renderCity}
          />
        ) : (
          <EmptyState onSearch={() => setSearchOpen(true)} />
        )}
      </main>

      <CitySearch
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        cities={cities}
        onAdd={(city) => {
          add(city);
          setActive(cities.length);
        }}
        onRemove={remove}
        onReorder={reorder}
        onSelect={setActive}
        settings={settings}
      />

      <SettingsSheet
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        onChange={update}
      />
    </div>
  );
}

function EmptyState({ onSearch }: { onSearch: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-24 text-center">
      <h2 className="text-3xl font-light text-white">No cities yet</h2>
      <p className="max-w-xs text-sm text-white/75">
        Add your first city to see hourly and 10-day forecasts, air quality, and more.
      </p>
      <button
        type="button"
        onClick={onSearch}
        className="mt-2 rounded-full bg-white px-5 py-2 text-[14px] font-medium text-slate-900 hover:bg-white/90"
      >
        Add a city
      </button>
    </div>
  );
}
