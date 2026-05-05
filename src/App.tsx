import { Plus, Search, Settings as SettingsIcon } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { CityCarousel } from './components/CityCarousel';
import { CityListItem } from './components/CityListItem';
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
import type { City, WeatherSnapshot } from './types';

export default function App() {
  const { cities, add, remove, reorder, upsertCurrent } = useCities();
  const { settings, update } = useSettings();
  const geo = useGeolocation();

  const [active, setActive] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [activeBundle, setActiveBundle] = useState<WeatherSnapshot | undefined>();

  const bootstrapRan = useRef(false);
  const initiallyEmptyRef = useRef(cities.length === 0);

  useEffect(() => {
    if (bootstrapRan.current) return;
    bootstrapRan.current = true;

    (async () => {
      if (initiallyEmptyRef.current) {
        for (const city of INITIAL_SEED) add(city);
      }

      const coords = await geo.request();
      if (!coords) return;

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

  const onSnapshot = useCallback((snapshot: WeatherSnapshot | undefined) => {
    setActiveBundle(snapshot);
  }, []);

  const renderCity = useCallback(
    (city: City) => (
      <CityView
        key={city.id}
        city={city}
        settings={settings}
        onSnapshot={onSnapshot}
      />
    ),
    [onSnapshot, settings],
  );

  const code = activeBundle?.data.current.code ?? 1;
  const isDay = activeBundle?.data.current.isDay ?? true;
  const localHour = localHourIn(
    activeBundle?.data.location.timezone,
    new Date(),
  );
  const gradient = gradientFor(code, isDay, localHour);

  const hasCurrent = cities.some((c) => c.isCurrent);
  const activeCity = cities[Math.min(active, Math.max(0, cities.length - 1))];

  return (
    <div className="relative min-h-[100dvh]">
      <DynamicBackground gradient={gradient} weatherCode={code} isDay={isDay} />

      <div className="flex min-h-[100dvh]">
        {/* Desktop sidebar */}
        <aside className="hidden w-72 shrink-0 flex-col gap-2 overflow-y-auto border-r border-white/10 px-3 py-4 md:flex lg:w-80">
          <div className="mb-2 flex items-center justify-between px-2">
            <h1 className="text-2xl font-semibold text-white">Weather</h1>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                aria-label="Open settings"
                onClick={() => setSettingsOpen(true)}
                className="grid h-8 w-8 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20"
              >
                <SettingsIcon className="h-3.5 w-3.5" strokeWidth={2.2} />
              </button>
              <button
                type="button"
                aria-label="Add city"
                onClick={() => setSearchOpen(true)}
                className="grid h-8 w-8 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20"
              >
                <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="mx-2 mb-2 flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-left text-sm text-white/65 transition hover:bg-white/15"
          >
            <Search className="h-4 w-4" strokeWidth={2.2} />
            Search city or airport
          </button>
          {cities.map((c, i) => (
            <CityListItem
              key={c.id}
              city={c}
              active={i === active}
              settings={settings}
              onClick={() => setActive(i)}
            />
          ))}
        </aside>

        {/* Main content */}
        <main className="relative flex flex-1 flex-col overflow-y-auto">
          {/* Mobile header */}
          <header className="flex items-center justify-between px-4 pt-4 pb-2 md:hidden">
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

          <div className="mx-auto w-full max-w-2xl flex-1 px-0 sm:px-2">
            {cities.length > 0 ? (
              // On desktop the carousel index is driven by sidebar clicks;
              // on mobile, swipes change `active`.
              <CityCarousel
                cities={cities}
                active={Math.min(active, cities.length - 1)}
                onChange={setActive}
                renderCity={renderCity}
              />
            ) : (
              <EmptyState onSearch={() => setSearchOpen(true)} />
            )}

            {/* When desktop sidebar is showing but there's no city, show a hint */}
            {cities.length > 0 && activeCity === undefined ? (
              <div className="hidden md:block px-6 py-12 text-center text-white/60">
                Pick a city from the sidebar.
              </div>
            ) : null}
          </div>
        </main>
      </div>

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
