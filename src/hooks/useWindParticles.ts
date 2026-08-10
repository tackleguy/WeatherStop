// MIT wind particle overlay — HTML canvas sibling of the MapLibre canvas.
// Samples Open-Meteo u/v via /api/weather/wind-grid (no proprietary deps).

import { useEffect, useRef } from 'react';
import type maplibregl from 'maplibre-gl';

interface WindGrid {
  bbox: [number, number, number, number];
  cols: number;
  rows: number;
  u: number[];
  v: number[];
}

interface Particle {
  x: number;
  y: number;
  age: number;
  life: number;
}

function sampleUv(
  grid: WindGrid,
  lon: number,
  lat: number,
): { u: number; v: number } | null {
  const [west, south, east, north] = grid.bbox;
  if (lon < west || lon > east || lat < south || lat > north) return null;
  const fx = ((lon - west) / (east - west)) * (grid.cols - 1);
  const fy = ((north - lat) / (north - south)) * (grid.rows - 1);
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const x1 = Math.min(x0 + 1, grid.cols - 1);
  const y1 = Math.min(y0 + 1, grid.rows - 1);
  const tx = fx - x0;
  const ty = fy - y0;
  const at = (x: number, y: number) => {
    const i = y * grid.cols + x;
    return { u: grid.u[i] ?? 0, v: grid.v[i] ?? 0 };
  };
  const a = at(x0, y0);
  const b = at(x1, y0);
  const c = at(x0, y1);
  const d = at(x1, y1);
  return {
    u:
      a.u * (1 - tx) * (1 - ty) +
      b.u * tx * (1 - ty) +
      c.u * (1 - tx) * ty +
      d.u * tx * ty,
    v:
      a.v * (1 - tx) * (1 - ty) +
      b.v * tx * (1 - ty) +
      c.v * (1 - tx) * ty +
      d.v * tx * ty,
  };
}

function speedColor(mph: number): string {
  const t = Math.min(1, Math.max(0, mph / 50));
  if (t < 0.5) {
    const u = t * 2;
    return `rgba(${Math.round(80 + u * 100)}, ${Math.round(180 + u * 40)}, ${Math.round(255 - u * 120)}, 0.85)`;
  }
  const u = (t - 0.5) * 2;
  return `rgba(${Math.round(180 + u * 75)}, ${Math.round(220 - u * 160)}, ${Math.round(80 - u * 60)}, 0.9)`;
}

interface Args {
  map: maplibregl.Map | null;
  styleLoaded: boolean;
  enabled: boolean;
  timeIso: string | null;
  opacity?: number;
}

export function useWindParticles({
  map,
  styleLoaded,
  enabled,
  timeIso,
  opacity = 0.95,
}: Args) {
  const gridRef = useRef<WindGrid | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const rafRef = useRef<number | null>(null);
  const opacityRef = useRef(opacity);
  opacityRef.current = opacity;

  useEffect(() => {
    if (!map || !styleLoaded || !enabled) {
      gridRef.current = null;
      return;
    }

    let cancelled = false;
    let timer: number | undefined;

    const load = () => {
      const b = map.getBounds();
      const bbox = `${b.getWest()},${b.getSouth()},${b.getEast()},${b.getNorth()}`;
      const params = new URLSearchParams({ bbox, cols: '40', rows: '24' });
      if (timeIso) params.set('time', timeIso);
      void fetch(`/api/weather/wind-grid?${params}`)
        .then(async (res) => {
          if (!res.ok || cancelled) return;
          const data = (await res.json()) as WindGrid;
          if (cancelled) return;
          gridRef.current = data;
          const next: Particle[] = [];
          for (let i = 0; i < 1600; i++) {
            next.push({
              x: b.getWest() + Math.random() * (b.getEast() - b.getWest()),
              y: b.getSouth() + Math.random() * (b.getNorth() - b.getSouth()),
              age: Math.random() * 80,
              life: 55 + Math.random() * 85,
            });
          }
          particlesRef.current = next;
        })
        .catch(() => undefined);
    };

    const debounced = () => {
      if (timer !== undefined) window.clearTimeout(timer);
      timer = window.setTimeout(load, 280);
    };

    load();
    map.on('moveend', debounced);
    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
      map.off('moveend', debounced);
    };
  }, [map, styleLoaded, enabled, timeIso]);

  useEffect(() => {
    if (!map || !styleLoaded || !enabled) {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      return;
    }

    const container = map.getCanvasContainer();
    const overlay = document.createElement('canvas');
    overlay.className = 'ws-wind-particles';
    overlay.style.position = 'absolute';
    overlay.style.inset = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.pointerEvents = 'none';
    overlay.style.zIndex = '1';
    container.appendChild(overlay);
    const octx = overlay.getContext('2d');
    if (!octx) {
      overlay.remove();
      return;
    }

    const tick = () => {
      const grid = gridRef.current;
      const particles = particlesRef.current;
      const dpr = window.devicePixelRatio || 1;
      const cssW = map.getCanvas().clientWidth;
      const cssH = map.getCanvas().clientHeight;
      if (
        overlay.width !== Math.floor(cssW * dpr) ||
        overlay.height !== Math.floor(cssH * dpr)
      ) {
        overlay.width = Math.floor(cssW * dpr);
        overlay.height = Math.floor(cssH * dpr);
      }
      octx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // Fade trails slightly for a Windy-like streak.
      octx.globalCompositeOperation = 'destination-out';
      octx.fillStyle = 'rgba(0,0,0,0.12)';
      octx.fillRect(0, 0, cssW, cssH);
      octx.globalCompositeOperation = 'source-over';

      if (grid && particles.length) {
        octx.globalAlpha = opacityRef.current;
        octx.lineWidth = 1.35;
        octx.lineCap = 'round';
        const b = map.getBounds();
        const west = b.getWest();
        const east = b.getEast();
        const south = b.getSouth();
        const north = b.getNorth();
        const span = Math.max(0.5, east - west);
        for (const p of particles) {
          const uv = sampleUv(grid, p.x, p.y);
          if (!uv) {
            p.x = west + Math.random() * (east - west);
            p.y = south + Math.random() * (north - south);
            p.age = 0;
            continue;
          }
          const speed = Math.hypot(uv.u, uv.v);
          const step = 0.00034 * span * (0.35 + speed / 28);
          const nx = p.x + uv.u * step;
          const ny = p.y + uv.v * step;
          const a = map.project([p.x, p.y]);
          const c = map.project([nx, ny]);
          octx.strokeStyle = speedColor(speed);
          octx.beginPath();
          octx.moveTo(a.x, a.y);
          octx.lineTo(c.x, c.y);
          octx.stroke();
          p.x = nx;
          p.y = ny;
          p.age += 1;
          if (
            p.age > p.life ||
            p.x < west ||
            p.x > east ||
            p.y < south ||
            p.y > north
          ) {
            p.x = west + Math.random() * (east - west);
            p.y = south + Math.random() * (north - south);
            p.age = 0;
            p.life = 50 + Math.random() * 90;
          }
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      overlay.remove();
    };
  }, [map, styleLoaded, enabled]);
}
