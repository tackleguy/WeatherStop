// City weather view. The body is essentially the old App.tsx body,
// adjusted to live below the floating pill nav. Sidebar + carousel are
// the same; the mobile header now ducks below the pill.

import { Layers, Plus, Search, Settings as SettingsIcon } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CityCarousel } from '../components/CityCarousel';
import { CityListItem } from '../components/CityListItem';
import { CitySearch } from '../components/CitySearch';
import { CityView } from '../components/CityView';
import { CompareModal } from '../components/CompareModal';
import { PageIndicator } from '../components/PageIndicator';
import { SettingsSheet } from '../components/SettingsSheet';
import { DynamicBackground } from '../components/backgrounds/DynamicBackground';
import { INITIAL_SEED } from '../constants/cities';
import { useCities } from '../hooks/useCities';
import { useGeolocation } from '../hooks/useGeolocation';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { useSettings } from '../hooks/useSettings';
import { invalidate } from '../lib/weatherCache';
import { localHourIn } from '../lib/format';
import { gradientFor } from '../lib/weatherCodes';
import { reverseGeocodeUS } from '../lib/nws';
import type { City, WeatherSnapshot } from '../types';

export function HomeView() {
  const { cities, add, remove, reorder, upsertCurrent } = useCities();
  const { settings, update } = useSettings();
  const geo = useGeolocation();
  const navigate = useNavigate();
  const { cityId } = useParams<{ cityId?: string }>();

  const [searchOpen, setSearchOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [activeBundle, setActiveBundle] = useState<WeatherSnapshot | undefined>();

  const indexFromUrl = cityId
    ? cities.findIndex((c) => c.id === cityId)
    : -1;
  const [activeFallback, setActiveFallback] = useState(0);
  const active = indexFromUrl >= 0 ? indexFromUrl : activeFallback;
  const setActive = useCallback(
    (next: number) => {
      const target = cities[next];
      if (target) navigate(`/city/${target.id}`);
      else setActiveFallback(next);
    },
    [cities, navigate],
  );

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
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  useKeyboardShortcuts({
    prevCity: () => setActive(Math.max(0, active - 1)),
    nextCity: () =>
      setActive(Math.min(Math.max(0, cities.length - 1), active + 1)),
    openSearch: () => setSearchOpen(true),
    openSettings: () => setSettingsOpen(true),
    toggleCompare: () => setCompareOpen((v) => !v),
    refresh: () => {
      if (activeCity) invalidate(activeCity);
      setActiveBundle((s) => (s ? { ...s } : s));
    },
    closeModals: () => {
      setSearchOpen(false);
      setSettingsOpen(false);
      setCompareOpen(false);
    },
  });

  return (
    <div className="relative h-full overflow-y-auto">
      <DynamicBackground gradient={gradient} weatherCode={code} isDay={isDay} />

      {/* Top spacer for the floating pill nav (h-12 mobile / h-14 desktop +
          16px top + breathing). */}
      <div className="h-20 sm:h-24" aria-hidden />

      <div className="flex">
        {/* Desktop sidebar */}
        <aside className="hidden w-72 shrink-0 flex-col gap-2 overflow-y-auto border-r border-white/10 px-3 pb-6 pt-2 md:flex lg:w-80">
          <div className="mb-2 flex items-center justify-between px-2">
            <h2 className="text-xl font-semibold text-white">Cities</h2>
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
                aria-label="Compare cities"
                title="Compare (C)"
                onClick={() => setCompareOpen(true)}
                disabled={cities.length < 2}
                className="grid h-8 w-8 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Layers className="h-3.5 w-3.5" strokeWidth={2.2} />
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

        <main className="relative flex flex-1 flex-col overflow-y-auto">
          {/* Mobile city controls — page indicator + add/settings live below the pill nav */}
          <header className="flex items-center justify-between px-4 pb-2 pt-1 md:hidden">
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
              <CityCarousel
                cities={cities}
                active={Math.min(active, cities.length - 1)}
                onChange={setActive}
                renderCity={renderCity}
              />
            ) : (
              <EmptyState onSearch={() => setSearchOpen(true)} />
            )}
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

      <CompareModal
        open={compareOpen}
        onClose={() => setCompareOpen(false)}
        cities={cities}
        settings={settings}
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
