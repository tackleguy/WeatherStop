import { Bell, Radio, Settings as SettingsIcon } from 'lucide-react';
import { useCallback, useMemo, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import { AlertsInspector } from './components/AlertsInspector';
import { ProductRail } from './components/ProductRail';
import { RadarMap } from './components/RadarMap';
import { SearchBar } from './components/SearchBar';
import { StationInventory } from './components/StationInventory';
import { TimeScrubber } from './components/TimeScrubber';
import { DEFAULT_PRODUCT, PRODUCTS, type ProductId } from './constants/products';
import { useAlerts, type NWSAlert } from './hooks/useAlerts';
import type { NexradSite } from './lib/nexradSites';

function flyToGeometry(map: maplibregl.Map, geometry: GeoJSON.Geometry) {
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
  const [alertsPanelOpen, setAlertsPanelOpen] = useState(true);
  const mapRef = useRef<maplibregl.Map | null>(null);

  const product = useMemo(
    () => PRODUCTS.find((p) => p.id === selectedProduct) ?? PRODUCTS[0],
    [selectedProduct],
  );

  const layerMode: 'radar' | 'satellite' =
    product.kind === 'satellite' ? 'satellite' : 'radar';
  const satelliteProduct: 'ir' | 'vis' =
    product.id === 'sat-vis' ? 'vis' : 'ir';

  const handleAlertSelect = useCallback((alert: NWSAlert) => {
    setSelectedAlertId(alert.id);
    if (mapRef.current && alert.geometry) {
      flyToGeometry(mapRef.current, alert.geometry);
    }
  }, []);

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
      <header className="flex h-11 items-center justify-between gap-3 border-b border-white/5 bg-[rgba(15,18,23,0.92)] px-4 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <Radio className="h-4 w-4 text-emerald-400" strokeWidth={2.2} />
          <h1 className="text-[13px] font-semibold uppercase tracking-[0.2em]">
            WeatherStop Radar
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <SearchBar
            onPick={(p) => {
              if (mapRef.current) {
                mapRef.current.flyTo({
                  center: [p.lon, p.lat],
                  zoom: 9,
                  duration: 800,
                });
              }
            }}
          />
          <button
            type="button"
            onClick={() => setAlertsPanelOpen((v) => !v)}
            aria-label="Toggle alerts"
            className="grid h-8 w-8 place-items-center rounded-lg border border-white/8 bg-black/45 text-white/75 hover:bg-white/12"
          >
            <Bell className="h-3.5 w-3.5" strokeWidth={2.2} />
          </button>
          <button
            type="button"
            onClick={() => setStationModalOpen(true)}
            aria-label="Stations"
            className="grid h-8 w-8 place-items-center rounded-lg border border-white/8 bg-black/45 text-white/75 hover:bg-white/12"
          >
            <SettingsIcon className="h-3.5 w-3.5" strokeWidth={2.2} />
          </button>
        </div>
      </header>

      {/* Mobile horizontal product strip — hidden ≥md */}
      <div className="border-b border-white/5 bg-[rgba(15,18,23,0.92)] px-2 py-2 md:hidden">
        <div className="flex gap-1 overflow-x-auto no-scrollbar">
          {PRODUCTS.map(({ id, short, label, icon: Icon, disabled }) => {
            const isActive = id === selectedProduct;
            return (
              <button
                key={id}
                type="button"
                disabled={disabled}
                onClick={() => !disabled && setSelectedProduct(id)}
                aria-label={label}
                className={`flex shrink-0 flex-col items-center gap-0.5 rounded-md px-3 py-1.5 text-[9px] font-semibold tracking-wider ${
                  disabled
                    ? 'text-white/25'
                    : isActive
                      ? 'bg-white text-black'
                      : 'bg-white/5 text-white/60'
                }`}
              >
                <Icon className="h-4 w-4" strokeWidth={1.8} />
                {short}
              </button>
            );
          })}
        </div>
      </div>

      {/* Body */}
      <div className="relative flex flex-1 gap-2 overflow-hidden p-2">
        <div className="hidden md:block">
          <ProductRail active={selectedProduct} onSelect={setSelectedProduct} />
        </div>
        <main className="relative flex-1 overflow-hidden rounded-xl border border-white/5">
          <RadarMap
            alerts={alerts}
            selectedTime={selectedTime}
            layerMode={layerMode}
            satelliteProduct={satelliteProduct}
            onAlertClick={handleAlertSelect}
            onMapReady={(m) => {
              mapRef.current = m;
            }}
          />
          {focusedSite ? (
            <div className="absolute left-3 top-3 z-10 flex items-center gap-2 rounded-lg border border-white/8 bg-black/55 px-3 py-1 text-[11px] font-medium text-white/85 backdrop-blur-md">
              Locked on {focusedSite.id} · {focusedSite.name}
              <button
                type="button"
                onClick={() => setFocusedSite(null)}
                className="text-white/60 hover:text-white"
              >
                ×
              </button>
            </div>
          ) : null}
        </main>
        {alertsPanelOpen ? (
          <div className="hidden lg:block">
            <AlertsInspector
              alerts={alerts}
              loading={loading}
              selectedId={selectedAlertId}
              onSelect={handleAlertSelect}
              onRefresh={refresh}
            />
          </div>
        ) : null}
      </div>

      {/* Time scrubber */}
      <div className="px-2 pb-2">
        <TimeScrubber selectedTime={selectedTime} onChange={setSelectedTime} />
      </div>

      {/* Mobile alerts drawer */}
      {alertsPanelOpen ? (
        <div className="lg:hidden border-t border-white/5">
          <AlertsInspector
            alerts={alerts}
            loading={loading}
            selectedId={selectedAlertId}
            onSelect={handleAlertSelect}
            onRefresh={refresh}
          />
        </div>
      ) : null}

      <StationInventory
        open={stationModalOpen}
        onClose={() => setStationModalOpen(false)}
        onSelect={handleSiteSelect}
        active={focusedSite?.id}
      />
    </div>
  );
}
