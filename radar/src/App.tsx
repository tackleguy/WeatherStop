import { Radio } from 'lucide-react';
import { useCallback, useMemo, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import { AlertsInspector } from './components/AlertsInspector';
import { ProductRail } from './components/ProductRail';
import { RadarMap } from './components/RadarMap';
import { StationInventory } from './components/StationInventory';
import { TimeScrubber } from './components/TimeScrubber';
import { DEFAULT_PRODUCT, PRODUCTS, type ProductId } from './constants/products';
import { useAlerts, type NWSAlert } from './hooks/useAlerts';
import type { NexradSite } from './lib/nexradSites';
import type { StormCell } from './lib/sourceResolver';

function flyToGeometry(map: maplibregl.Map, geometry: GeoJSON.Geometry) {
  if (!geometry) return;
  const bounds = new maplibregl.LngLatBounds();
  const coords: number[][] = [];
  function collect(g: GeoJSON.Geometry) {
    if (g.type === 'Polygon') for (const ring of g.coordinates) coords.push(...ring);
    else if (g.type === 'MultiPolygon')
      for (const poly of g.coordinates)
        for (const ring of poly) coords.push(...ring);
    else if (g.type === 'Point') coords.push(g.coordinates as number[]);
  }
  collect(geometry);
  for (const c of coords) bounds.extend([c[0], c[1]] as [number, number]);
  if (!bounds.isEmpty()) {
    map.fitBounds(bounds, { padding: 100, duration: 700, maxZoom: 9 });
  }
}

export default function App() {
  const { alerts, loading, refresh } = useAlerts();
  const [selectedProduct, setSelectedProduct] = useState<ProductId>(DEFAULT_PRODUCT);
  const [selectedTime, setSelectedTime] = useState(() =>
    Math.floor(Date.now() / 1000),
  );
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null);
  const [stationModalOpen, setStationModalOpen] = useState(false);
  const [focusedSite, setFocusedSite] = useState<NexradSite | null>(null);
  const [focusedStorm] = useState<StormCell | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  const productCode = useMemo(
    () =>
      PRODUCTS.find((p) => p.id === selectedProduct)?.l3Code ?? 'p19r0',
    [selectedProduct],
  );

  const handleAlertSelect = useCallback(
    (alert: NWSAlert) => {
      setSelectedAlertId(alert.id);
      if (mapRef.current && alert.geometry) {
        flyToGeometry(mapRef.current, alert.geometry);
      }
    },
    [],
  );

  const handleSiteSelect = useCallback((site: NexradSite) => {
    setFocusedSite(site);
    if (mapRef.current) {
      mapRef.current.flyTo({
        center: [site.lon, site.lat],
        zoom: 9,
        duration: 800,
      });
    }
  }, []);

  return (
    <div className="flex h-[100dvh] w-full flex-col bg-ink-950 text-white">
      {/* Top bar */}
      <header className="flex items-center justify-between border-b border-white/5 px-4 py-2">
        <div className="flex items-center gap-2">
          <Radio className="h-4 w-4 text-emerald-400" strokeWidth={2.2} />
          <h1 className="text-sm font-semibold uppercase tracking-[0.18em]">
            WeatherStop Radar
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setStationModalOpen(true)}
            className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/85 hover:bg-white/20"
          >
            Stations
          </button>
        </div>
      </header>

      {/* Main row: rail + map + alerts */}
      <div className="relative flex flex-1 gap-2 overflow-hidden p-2">
        <div className="hidden md:block">
          <ProductRail active={selectedProduct} onSelect={setSelectedProduct} />
        </div>
        <main className="relative flex-1 overflow-hidden rounded-2xl">
          <RadarMap
            alerts={alerts}
            selectedProduct={productCode}
            selectedTime={selectedTime}
            focusedStorm={focusedStorm}
            onAlertClick={handleAlertSelect}
            onMapReady={(m) => {
              mapRef.current = m;
            }}
          />
          {focusedSite ? (
            <div className="absolute left-3 top-3 z-10 rounded-full bg-black/60 px-3 py-1 text-[11px] font-medium text-white/85 backdrop-blur">
              Locked on {focusedSite.id} · {focusedSite.name}
              <button
                type="button"
                onClick={() => setFocusedSite(null)}
                className="ml-2 text-white/60 hover:text-white"
              >
                ×
              </button>
            </div>
          ) : null}
        </main>
        <div className="hidden lg:block">
          <AlertsInspector
            alerts={alerts}
            loading={loading}
            selectedId={selectedAlertId}
            onSelect={handleAlertSelect}
            onRefresh={refresh}
          />
        </div>
      </div>

      {/* Time scrubber */}
      <div className="px-2 pb-2">
        <TimeScrubber
          selectedTime={selectedTime}
          onChange={setSelectedTime}
        />
      </div>

      {/* Mobile bottom rail (mini) */}
      <div className="md:hidden border-t border-white/5 px-2 pb-2 pt-2">
        <div className="flex gap-1 overflow-x-auto no-scrollbar">
          {PRODUCTS.map(({ id, short, label, icon: Icon }) => {
            const isActive = id === selectedProduct;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setSelectedProduct(id)}
                aria-label={label}
                className={`flex shrink-0 flex-col items-center gap-0.5 rounded-xl px-3 py-1.5 text-[9px] font-semibold tracking-wider ${
                  isActive ? 'bg-white/15 text-white' : 'bg-white/5 text-white/60'
                }`}
              >
                <Icon className="h-4 w-4" strokeWidth={1.8} />
                {short}
              </button>
            );
          })}
        </div>
      </div>

      <StationInventory
        open={stationModalOpen}
        onClose={() => setStationModalOpen(false)}
        onSelect={handleSiteSelect}
        active={focusedSite?.id}
      />
    </div>
  );
}
