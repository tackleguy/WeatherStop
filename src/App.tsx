import { Plus, Settings as SettingsIcon } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { CityCarousel } from './components/CityCarousel';
import { CitySearch } from './components/CitySearch';
import { CityView } from './components/CityView';
import { PageIndicator } from './components/PageIndicator';
import { SettingsSheet } from './components/SettingsSheet';
import { DynamicBackground } from './components/backgrounds/DynamicBackground';
import { useCities } from './hooks/useCities';
import { useGeolocation } from './hooks/useGeolocation';
import { useSettings } from './hooks/useSettings';
import { localHourIn } from './lib/format';
import { gradientFor } from './lib/weatherCodes';
import { forecast } from './lib/openMeteo';
import type { City, WeatherBundle } from './types';

export default function App() {
  const { cities, add, remove, reorder, upsertCurrent } = useCities();
  const { settings, update } = useSettings();
  const geo = useGeolocation();

  const [active, setActive] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [activeBundle, setActiveBundle] = useState<WeatherBundle | undefined>();
  const [bootstrapped, setBootstrapped] = useState(false);

  // First-load: try geolocation, fall back to opening the search modal.
  useEffect(() => {
    if (bootstrapped) return;
    setBootstrapped(true);

    (async () => {
      const coords = await geo.request();
      if (coords) {
        try {
          const f = await forecast(coords.latitude, coords.longitude, settings);
          const city: City = {
            id: 'current',
            name: f.timezone.split('/').pop()?.replace(/_/g, ' ') || 'Current Location',
            latitude: coords.latitude,
            longitude: coords.longitude,
            timezone: f.timezone,
            isCurrent: true,
          };
          upsertCurrent(city);
          setActive(0);
        } catch {
          if (cities.length === 0) setSearchOpen(true);
        }
      } else if (cities.length === 0) {
        setSearchOpen(true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Whenever the active index goes out of bounds, clamp.
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

  // Pick the gradient for the active city based on its weather + local hour.
  const code = activeBundle?.forecast.current.weather_code ?? 1;
  const isDay = activeBundle?.forecast.current.is_day === 1;
  const localHour = localHourIn(activeBundle?.forecast.timezone, new Date());
  const gradient = gradientFor(code, isDay, localHour);

  const hasCurrent = cities.some((c) => c.isCurrent);

  return (
    <div className="relative mx-auto flex min-h-[100dvh] max-w-md flex-col">
      <DynamicBackground gradient={gradient} weatherCode={code} isDay={isDay} />

      <header className="flex items-center justify-between px-4 pt-4">
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
          // Activate the newly added city.
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
