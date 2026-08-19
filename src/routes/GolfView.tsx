// Golf: OSM courses + satellite map + multi-model hole wind briefs.

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Compass,
  Flag,
  Loader2,
  MapPin,
  Navigation,
  RefreshCw,
  Search,
  Settings2,
  Sparkles,
  CloudSun,
} from 'lucide-react';
import { GolfMap } from '../components/golf/GolfMap';
import { GolfMapBoundary } from '../components/golf/GolfMapBoundary';
import { GolfHoleIntel } from '../components/golf/GolfHoleIntel';
import { GolfSetup } from '../components/golf/GolfSetup';
import { GolfTargetHud } from '../components/golf/GolfTargetHud';
import { GolfYardageBook } from '../components/golf/GolfYardageBook';
import { GlassPanel } from '../components/ui/GlassPanel';
import { SearchBar } from '../components/radar/SearchBar';
import { INITIAL_SEED } from '../constants/cities';
import { useIsMobile } from '../hooks/useMediaQuery';
import { bearingCompass } from '../lib/geo';
import {
  useGolfCourses,
  useGolfEnsemble,
  useGolfHoles,
  useGolfNotebook,
} from '../hooks/useGolf';
import type { GolfCourseSummary, HoleBrief, TeeKind } from '../lib/golf';
import { DEFAULT_TURF } from '../lib/golf';
import {
  bagArcClubs,
  defaultTarget,
  metersToFeet,
} from '../lib/golfMeasure';
import { playLinesGeoJSON, predictHole } from '../lib/golfPredict';
import {
  bagFromStocks,
  DEFAULT_PROFILE,
  loadGolfProfile,
  type GolfPlayerProfile,
} from '../lib/golfProfile';
import { weatherAppHref } from '../lib/golfApp';
import type { LonLat } from '../lib/golfWind';
import {
  applyTee,
  availableTeeKinds,
  holesOnLoop,
  loopNames,
  pickLoopForCourse,
  pickTee,
  teeKindLabel,
  teesOnHole,
} from '../lib/golfTees';

interface Loc {
  name: string;
  lat: number;
  lon: number;
}

function defaultLoc(): Loc {
  try {
    const raw = localStorage.getItem('cities-v1');
    if (raw) {
      const parsed = JSON.parse(raw) as Array<{
        name: string;
        latitude: number;
        longitude: number;
        isCurrent?: boolean;
      }>;
      const current = parsed.find((c) => c.isCurrent) ?? parsed[0];
      if (current) {
        return {
          name: current.name,
          lat: current.latitude,
          lon: current.longitude,
        };
      }
    }
  } catch {
    // ignore
  }
  const seed = INITIAL_SEED[0];
  return {
    name: seed?.name ?? 'Kansas City',
    lat: seed?.latitude ?? 39.1,
    lon: seed?.longitude ?? -94.6,
  };
}

function aspectLabel(aspect: string): string {
  switch (aspect) {
    case 'head':
      return 'Headwind';
    case 'tail':
      return 'Tailwind';
    case 'cross-L':
      return 'Cross ←';
    case 'cross-R':
      return 'Cross →';
    case 'quarter-head':
      return '¼ Head';
    case 'quarter-tail':
      return '¼ Tail';
    default:
      return aspect;
  }
}

const MOBILE_FIT_PADDING = { top: 88, right: 28, bottom: 196, left: 28 };

function ChipRow({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Array<{ id: string; label: string }>;
  value: string;
  onChange: (id: string) => void;
}) {
  if (options.length < 2) return null;
  return (
    <div className="px-3 pb-2">
      <div className="mb-1 text-[10px] uppercase tracking-wide text-[var(--ink-4)]">
        {label}
      </div>
      <div className="flex flex-wrap gap-1">
        {options.map((opt) => {
          const on = opt.id === value;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onChange(opt.id)}
              className={[
                'rounded-md px-2 py-1 text-[11px] font-medium transition-colors',
                on
                  ? 'bg-[var(--accent)]/30 text-[var(--ink-1)]'
                  : 'bg-black/25 text-[var(--ink-3)] hover:bg-white/10 hover:text-[var(--ink-1)]',
              ].join(' ')}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function GolfView() {
  const isMobile = useIsMobile();
  const [profile, setProfile] = useState<GolfPlayerProfile>(
    () => loadGolfProfile() ?? DEFAULT_PROFILE,
  );
  const [setupOpen, setSetupOpen] = useState(false);
  const [loc, setLoc] = useState<Loc>(defaultLoc);
  const [course, setCourse] = useState<GolfCourseSummary | null>(null);
  const [activeHole, setActiveHole] = useState<number | null>(null);
  const [loop, setLoop] = useState<string | null>(null);
  const [teeKind, setTeeKind] = useState<TeeKind>('mid');
  const [hour, setHour] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const [courseFilter, setCourseFilter] = useState('');
  const [holeUp, setHoleUp] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(true);
  const [sheetExpanded, setSheetExpanded] = useState(false);
  const [target, setTarget] = useState<LonLat | null>(null);
  const [bookOpen, setBookOpen] = useState(false);

  const searchLat = course?.lat ?? loc.lat;
  const searchLon = course?.lon ?? loc.lon;
  const showPicker = !isMobile || pickerOpen || !course;

  const {
    courses,
    loading: coursesLoading,
    error: coursesError,
    retry: retryCourses,
  } = useGolfCourses(loc.lat, loc.lon, courseFilter);
  const {
    holes,
    loading: holesLoading,
    error: holesError,
    retry: retryHoles,
  } = useGolfHoles(
    course?.lat ?? null,
    course?.lon ?? null,
    course
      ? { bbox: course.bbox, osmType: course.osmType, osmId: course.osmId }
      : null,
  );

  const loops = useMemo(() => loopNames(holes), [holes]);
  const resolvedLoop =
    loop ?? pickLoopForCourse(course?.name ?? '', loops);
  const loopHoles = useMemo(
    () => holesOnLoop(holes, resolvedLoop),
    [holes, resolvedLoop],
  );
  const playHoles = useMemo(
    () => loopHoles.map((h) => applyTee(h, teeKind)),
    [loopHoles, teeKind],
  );
  const teeKinds = useMemo(() => availableTeeKinds(loopHoles), [loopHoles]);

  useEffect(() => {
    const next = pickLoopForCourse(course?.name ?? '', loopNames(holes));
    setLoop(next);
    setTeeKind('mid');
    setActiveHole(null);
  }, [holes, course?.id, course?.name]);

  // One character filters the nearby list; two or more searches the
  // nationwide 1,000+ public and private course catalog through Photon.
  const filteredCourses = useMemo(() => {
    const q = courseFilter.trim().toLowerCase();
    if (!q) return courses;
    if (q.length >= 2) return courses;
    return courses.filter((c) => c.name.toLowerCase().includes(q));
  }, [courses, courseFilter]);
  const {
    data: ensemble,
    loading: ensLoading,
    error: ensError,
  } = useGolfEnsemble(
    course?.lat ?? null,
    course?.lon ?? null,
    playHoles,
    hour,
    profile,
  );

  const {
    data: notebook,
    loading: notebookLoading,
    error: notebookError,
  } = useGolfNotebook(
    course?.lat ?? null,
    course?.lon ?? null,
    playHoles,
    profile,
    bookOpen,
  );

  const bag = useMemo(
    () =>
      bagFromStocks(
        profile?.driverYards ?? 225,
        profile?.sevenIronYards ?? 150,
      ),
    [profile],
  );
  const arcClubs = useMemo(() => bagArcClubs(bag), [bag]);
  const courseElevFt = useMemo(() => {
    const tees = playHoles
      .map((h) => h.teeElevationM)
      .filter((m): m is number => typeof m === 'number' && Number.isFinite(m));
    if (!tees.length) return 0;
    return Math.round(
      metersToFeet(tees.reduce((s, n) => s + n, 0) / tees.length),
    );
  }, [playHoles]);

  const activeHoleObj = useMemo(
    () => playHoles.find((h) => h.number === activeHole) ?? null,
    [playHoles, activeHole],
  );

  useEffect(() => {
    if (!activeHoleObj || !profile) {
      setTarget(null);
      return;
    }
    setTarget(defaultTarget(activeHoleObj, bag[0]?.yards ?? profile.driverYards));
  }, [activeHoleObj, profile, bag]);

  const briefByHole = useMemo(() => {
    const m = new Map<number, HoleBrief>();
    for (const h of ensemble?.holes ?? []) m.set(h.number, h);
    return m;
  }, [ensemble]);

  const activeBrief =
    activeHole != null ? briefByHole.get(activeHole) : undefined;
  const turf = ensemble?.turf ?? DEFAULT_TURF;
  const forecast = useMemo(() => {
    if (!activeHoleObj || !target || !profile) return null;
    return predictHole({
      hole: activeHoleObj,
      target,
      bag,
      profile,
      brief: activeBrief,
      turf,
    });
  }, [activeHoleObj, target, bag, profile, activeBrief, turf]);
  const playLines = useMemo(() => playLinesGeoJSON(forecast), [forecast]);
  const activeIdx = playHoles.findIndex((h) => h.number === activeHole);
  const layoutLabel = [
    `${playHoles.length} holes`,
    loops.length > 1 ? resolvedLoop : null,
    teeKinds.length > 1 ? teeKindLabel(teeKind) : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const pickCourse = useCallback(
    (next: GolfCourseSummary) => {
      setCourse(next);
      setActiveHole(null);
      setLoop(null);
      setTeeKind('mid');
      setTarget(null);
      setBookOpen(false);
      setSheetExpanded(false);
      if (isMobile) setPickerOpen(false);
    },
    [isMobile],
  );

  const stepHole = useCallback(
    (delta: number) => {
      if (!playHoles.length) return;
      setActiveHole((prev) => {
        if (prev == null) return playHoles[0].number;
        const i = playHoles.findIndex((h) => h.number === prev);
        if (i < 0) return playHoles[0].number;
        const next = Math.min(Math.max(i + delta, 0), playHoles.length - 1);
        return playHoles[next].number;
      });
    },
    [playHoles],
  );

  // Arrow keys walk the course once a hole is open.
  useEffect(() => {
    if (activeHole == null) return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        stepHole(1);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        stepHole(-1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeHole, stepHole]);

  if (setupOpen) {
    return (
      <GolfSetup
        initial={profile}
        onComplete={(next) => {
          setProfile(next);
          setSetupOpen(false);
          if (next.commonCourses[0]) setCourseFilter(next.commonCourses[0]);
        }}
        onCancel={() => setSetupOpen(false)}
      />
    );
  }

  const hourSlider = course ? (
    <div className={isMobile ? 'px-3 pb-2' : 'border-t border-[var(--line-subtle)] p-3'}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium uppercase tracking-wide text-[var(--ink-3)]">
          Forecast hour
        </span>
        <span className="text-[11px] tabular-nums text-[var(--ink-2)]">
          +{hour}h
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={24}
        value={hour}
        onChange={(e) => setHour(Number(e.target.value))}
        className="w-full accent-[var(--accent)]"
      />
      {ensemble && (
        <p className="mt-2 text-[11px] leading-snug text-[var(--ink-2)]">
          <Sparkles className="mr-1 inline h-3 w-3 text-[var(--accent)]" />
          {ensemble.summary}
        </p>
      )}
      {ensLoading && (
        <p className="mt-2 flex items-center gap-1.5 text-[11px] text-[var(--ink-3)]">
          <RefreshCw className="h-3 w-3 animate-spin" />
          Blending models…
        </p>
      )}
      {ensError && (
        <p className="mt-2 text-[11px] text-red-300">{ensError}</p>
      )}
    </div>
  ) : null;

  return (
    <div className="absolute inset-0 flex min-h-0 flex-col md:flex-row">
      {/* Course picker — full screen on phones until a course is chosen. */}
      <aside
        className={
          isMobile
            ? [
                'z-20 flex min-h-0 flex-col bg-[var(--surface-0)]',
                showPicker
                  ? course
                    ? 'absolute inset-0'
                    : 'relative h-full'
                  : 'hidden',
              ].join(' ')
            : 'z-10 flex h-full w-[360px] shrink-0 flex-col border-r border-[var(--line-subtle)]'
        }
      >
        <div className="flex items-center gap-2 px-3 py-3">
          <Flag className="h-4 w-4 text-[var(--accent)]" strokeWidth={1.8} />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-sm font-semibold text-[var(--ink-1)]">
              WeatherStop Golf
            </h1>
            <p className="truncate text-[11px] text-[var(--ink-3)]">
              1,000+ public &amp; private · multi-model wind
            </p>
          </div>
          <a
            href={weatherAppHref()}
            className="rounded-lg p-2.5 text-[var(--ink-3)] hover:bg-white/5 hover:text-[var(--ink-1)]"
            aria-label="WeatherStop weather"
            title="WeatherStop weather"
          >
            <CloudSun className="h-4 w-4" />
          </a>
          {isMobile && course ? (
            <button
              type="button"
              className="rounded-lg px-2 py-2 text-[12px] font-medium text-[var(--ink-2)] hover:bg-white/5 hover:text-[var(--ink-1)]"
              onClick={() => setPickerOpen(false)}
            >
              Map
            </button>
          ) : null}
          <button
            type="button"
            className="rounded-lg p-2.5 text-[var(--ink-3)] hover:bg-white/5 hover:text-[var(--ink-1)]"
            aria-label="Edit golf profile"
            title={`Edit profile · HCP ${profile.handicap}`}
            onClick={() => setSetupOpen(true)}
          >
            <Settings2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="rounded-lg p-2.5 text-[var(--ink-3)] hover:bg-white/5 hover:text-[var(--ink-1)]"
            aria-label="Change location"
            onClick={() => setSearchOpen((v) => !v)}
          >
            <Search className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center gap-2 px-3 pb-2">
          <MapPin className="h-3.5 w-3.5 shrink-0 text-[var(--ink-4)]" />
          <span className="truncate text-xs text-[var(--ink-2)]">{loc.name}</span>
        </div>

        {searchOpen ? (
          <div className="px-3 pb-2">
            <SearchBar
              onPick={(p) => {
                setLoc({ name: p.label, lat: p.lat, lon: p.lon });
                setCourse(null);
                setActiveHole(null);
                setTarget(null);
                setBookOpen(false);
                setPickerOpen(true);
                setSearchOpen(false);
              }}
            />
          </div>
        ) : null}

        <div className="px-3 pb-2">
          <input
            type="search"
            enterKeyHint="search"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            value={courseFilter}
            onChange={(e) => setCourseFilter(e.target.value)}
            placeholder="City courses & private clubs…"
            className="w-full rounded-lg border border-[var(--line-default)] bg-black/20 px-3 py-2.5 text-base text-[var(--ink-1)] placeholder:text-[var(--ink-4)] outline-none focus:border-[var(--accent)] md:py-1.5 md:text-xs"
          />
        </div>

        {profile.commonCourses.length > 0 && (
          <div className="flex gap-1.5 overflow-x-auto px-3 pb-2">
            {profile.commonCourses.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => setCourseFilter(name)}
                className="shrink-0 rounded-full border border-[var(--line-subtle)] bg-black/15 px-3 py-1.5 text-[12px] text-[var(--ink-3)] hover:border-[var(--accent)]/50 hover:text-[var(--ink-1)] md:px-2 md:py-1 md:text-[10px]"
              >
                {name}
              </button>
            ))}
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-2">
          {coursesLoading && (
            <div className="flex items-center gap-2 px-2 py-3 text-xs text-[var(--ink-3)]">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />{' '}
              {courseFilter.trim().length >= 2
                ? 'Searching 1,000+ U.S. courses…'
                : 'Finding nearby courses…'}
            </div>
          )}
          {coursesError && (
            <div className="px-2 py-2">
              <p className="text-xs text-red-300">
                OpenStreetMap is busy right now.
              </p>
              <p className="mt-0.5 text-[10px] text-[var(--ink-4)]">
                {coursesError}
              </p>
              <button
                type="button"
                onClick={retryCourses}
                className="mt-1.5 rounded-md bg-white/10 px-2 py-1 text-[11px] font-medium text-[var(--ink-1)] hover:bg-white/15"
              >
                Try again
              </button>
            </div>
          )}
          {!coursesLoading && !courses.length && (
            <p className="px-2 py-3 text-xs text-[var(--ink-3)]">
              No golf courses found nearby. Try another city.
            </p>
          )}
          {!coursesLoading && courses.length > 0 && !filteredCourses.length && (
            <p className="px-2 py-3 text-xs text-[var(--ink-3)]">
              No courses match “{courseFilter}”.
            </p>
          )}
          <ul className="space-y-1">
            {filteredCourses.map((c) => {
              const active = course?.id === c.id;
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => pickCourse(c)}
                    className={[
                      'w-full rounded-xl px-3 py-3 text-left transition-colors md:py-2.5',
                      active
                        ? 'bg-[var(--accent)]/20 ring-1 ring-[var(--accent)]/50'
                        : 'hover:bg-white/5',
                    ].join(' ')}
                  >
                    <div className="truncate text-[13px] font-medium text-[var(--ink-1)]">
                      {c.name}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-[var(--ink-3)]">
                      {c.access === 'public' && (
                        <span className="rounded bg-emerald-500/20 px-1 py-px font-medium text-emerald-200">
                          Public
                        </span>
                      )}
                      {c.access === 'private' && (
                        <span className="rounded bg-amber-500/20 px-1 py-px font-medium text-amber-100">
                          Private
                        </span>
                      )}
                      {c.access === 'resort' && (
                        <span className="rounded bg-sky-500/20 px-1 py-px font-medium text-sky-100">
                          Resort
                        </span>
                      )}
                      {c.distanceMi != null && (
                        <span>{c.distanceMi.toFixed(1)} mi</span>
                      )}
                      {c.region && <span className="truncate">{c.region}</span>}
                      {c.holes != null && <span>{c.holes} holes</span>}
                      {c.par != null && <span>par {c.par}</span>}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        {course && !isMobile ? hourSlider : null}
      </aside>

      {/* Map + hole board */}
      <div
        className={[
          'relative min-h-0 flex-1 overflow-hidden',
          isMobile && !course ? 'hidden' : '',
        ].join(' ')}
      >
        {course ? (
          <>
            <GolfMapBoundary
              fallback={
                <div className="flex h-full items-center justify-center bg-[var(--surface-0)] px-6 text-center text-sm text-[var(--ink-3)]">
                  Satellite map couldn’t start on this device. Hole wind is
                  still available in the panel.
                </div>
              }
            >
              <GolfMap
                lat={searchLat}
                lon={searchLon}
                holes={playHoles}
                activeHole={activeHole}
                onSelectHole={setActiveHole}
                target={target}
                arcClubs={arcClubs}
                onSetTarget={setTarget}
                playLines={playLines}
                windFromDeg={ensemble?.ensemble.windFromDeg ?? null}
                windMph={ensemble?.ensemble.windMph ?? null}
                headwindMph={activeBrief?.headwindMph ?? null}
                crosswindMph={activeBrief?.crosswindMph ?? null}
                holeUp={holeUp}
                compactControls={isMobile}
                showWindLegend={!isMobile}
                fitPadding={isMobile ? MOBILE_FIT_PADDING : 60}
                legendClassName="left-3 top-16"
              />
            </GolfMapBoundary>

            {activeHoleObj && target && profile ? (
              <GolfTargetHud
                hole={activeHoleObj}
                target={target}
                bag={bag}
                brief={activeBrief}
                elevFt={courseElevFt}
                turf={turf}
                forecast={forecast}
                onReset={() =>
                  setTarget(
                    defaultTarget(
                      activeHoleObj,
                      bag[0]?.yards ?? profile.driverYards,
                    ),
                  )
                }
              />
            ) : null}

            {/* Hole-by-hole walkthrough + course switcher */}
            {(isMobile || playHoles.length > 0) && (
              <div className="pointer-events-none absolute inset-x-0 top-3 z-10 flex justify-center px-3 md:right-[352px] md:left-3 md:inset-x-auto md:justify-start">
                <GlassPanel
                  variant="high"
                  className="pointer-events-auto flex max-w-full items-center gap-0.5 px-1 py-1 shadow-xl"
                >
                  {isMobile ? (
                    <button
                      type="button"
                      onClick={() => setPickerOpen(true)}
                      aria-label="Change course"
                      className="shrink-0 rounded-lg px-2 py-2 text-[11px] font-medium text-[var(--ink-2)] hover:bg-white/10 hover:text-[var(--ink-1)]"
                    >
                      Courses
                    </button>
                  ) : null}
                  {playHoles.length > 0 ? (
                    <>
                      <button
                        type="button"
                        onClick={() => stepHole(-1)}
                        disabled={activeIdx <= 0}
                        aria-label="Previous hole"
                        className="rounded-lg p-2 text-[var(--ink-2)] transition-colors hover:bg-white/10 hover:text-[var(--ink-1)] disabled:opacity-30 md:p-1.5"
                      >
                        <ChevronLeft className="h-5 w-5 md:h-4 md:w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setActiveHole(
                            activeHole == null ? playHoles[0].number : null,
                          )
                        }
                        className="min-w-[96px] rounded-lg px-2 py-0.5 text-center transition-colors hover:bg-white/10"
                        title={
                          activeHole == null
                            ? 'Start the walkthrough'
                            : 'Back to full course'
                        }
                      >
                        <span className="block text-[10px] uppercase tracking-wide text-[var(--ink-4)]">
                          {activeHole == null ? 'Course' : 'Hole'}
                        </span>
                        <span className="block text-[13px] font-semibold tabular-nums text-[var(--ink-1)]">
                          {activeHole == null
                            ? layoutLabel
                            : `${activeHole} · ${playHoles[activeIdx]?.yards ?? '—'} yd`}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => stepHole(1)}
                        disabled={activeIdx >= playHoles.length - 1}
                        aria-label="Next hole"
                        className="rounded-lg p-2 text-[var(--ink-2)] transition-colors hover:bg-white/10 hover:text-[var(--ink-1)] disabled:opacity-30 md:p-1.5"
                      >
                        <ChevronRight className="h-5 w-5 md:h-4 md:w-4" />
                      </button>
                      <span className="mx-0.5 h-6 w-px bg-[var(--line-subtle)]" />
                      <button
                        type="button"
                        onClick={() => setHoleUp((v) => !v)}
                        aria-pressed={holeUp}
                        title="Rotate map so the hole plays up the screen"
                        className={[
                          'rounded-lg p-2 transition-colors md:p-1.5',
                          holeUp
                            ? 'bg-[var(--accent)]/25 text-[var(--ink-1)]'
                            : 'text-[var(--ink-3)] hover:bg-white/10',
                        ].join(' ')}
                      >
                        <Compass className="h-5 w-5 md:h-4 md:w-4" />
                      </button>
                    </>
                  ) : null}
                </GlassPanel>
              </div>
            )}

            <div
              className={
                isMobile
                  ? 'pointer-events-none absolute inset-x-0 bottom-0 z-10 p-3'
                  : 'pointer-events-none absolute inset-x-0 bottom-0 p-3 md:inset-x-auto md:right-3 md:top-3 md:bottom-3 md:w-[320px]'
              }
            >
              <GlassPanel
                className={[
                  'pointer-events-auto flex flex-col overflow-hidden p-0 shadow-xl',
                  isMobile
                    ? sheetExpanded
                      ? 'max-h-[min(58dvh,26rem)]'
                      : 'max-h-[9.5rem]'
                    : 'max-h-full',
                ].join(' ')}
              >
                {isMobile ? (
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 border-b border-[var(--line-subtle)] px-3 py-2.5 text-left"
                    onClick={() => setSheetExpanded((v) => !v)}
                    aria-expanded={sheetExpanded}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-[var(--ink-1)]">
                        {course.name}
                      </div>
                      <div className="text-[11px] text-[var(--ink-3)]">
                        {holesLoading
                          ? 'Loading hole geometry…'
                          : holesError
                            ? 'OpenStreetMap is busy — hole data unavailable'
                            : playHoles.length
                              ? ensemble?.ensemble.windMph != null
                                ? `${layoutLabel} · ${Math.round(ensemble.ensemble.windMph)} mph ${bearingCompass(ensemble.ensemble.windFromDeg)}`
                                : `${layoutLabel} · yardage, bearing & elevation`
                              : 'No hole geometry in OSM for this course yet'}
                      </div>
                    </div>
                    {sheetExpanded ? (
                      <ChevronDown className="h-4 w-4 shrink-0 text-[var(--ink-3)]" />
                    ) : (
                      <ChevronUp className="h-4 w-4 shrink-0 text-[var(--ink-3)]" />
                    )}
                  </button>
                ) : (
                  <div className="border-b border-[var(--line-subtle)] px-3 py-2.5">
                    <div className="truncate text-sm font-semibold text-[var(--ink-1)]">
                      {course.name}
                    </div>
                    <div className="text-[11px] text-[var(--ink-3)]">
                      {holesLoading
                        ? 'Loading hole geometry…'
                        : holesError
                          ? 'OpenStreetMap is busy — hole data unavailable'
                          : playHoles.length
                            ? `${layoutLabel} · yardage, bearing & elevation`
                            : 'No hole geometry in OSM for this course yet'}
                    </div>
                  </div>
                )}
                {holesError && (
                  <div className="px-3 pb-2">
                    <button
                      type="button"
                      onClick={retryHoles}
                      className="mt-1.5 rounded-md bg-white/10 px-2 py-1 text-[11px] font-medium text-[var(--ink-1)] hover:bg-white/15"
                    >
                      Retry holes
                    </button>
                  </div>
                )}
                <div className="px-3 pb-2">
                  <button
                    type="button"
                    onClick={() => setBookOpen(true)}
                    className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-[var(--accent)]/20 px-2 py-1.5 text-[11px] font-semibold text-[var(--ink-1)] hover:bg-[var(--accent)]/30"
                  >
                    <BookOpen className="h-3.5 w-3.5" />
                    Yardage book
                  </button>
                </div>
                {(!isMobile || sheetExpanded) && (
                  <>
                    <ChipRow
                      label="Course"
                      options={loops.map((name) => ({ id: name, label: name }))}
                      value={resolvedLoop ?? ''}
                      onChange={(id) => {
                        setLoop(id);
                        setActiveHole(null);
                      }}
                    />
                    <ChipRow
                      label="Tees"
                      options={teeKinds.map((kind) => ({
                        id: kind,
                        label: teeKindLabel(kind),
                      }))}
                      value={teeKind}
                      onChange={(id) => setTeeKind(id as TeeKind)}
                    />
                  </>
                )}

                {activeBrief && (
                  <div className="border-b border-[var(--line-subtle)] bg-[var(--accent)]/10 px-3 py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-[var(--ink-1)]">
                        Hole {activeBrief.number}
                      </span>
                      <span className="rounded-md bg-black/25 px-1.5 py-0.5 text-[10px] font-medium text-[var(--ink-2)]">
                        {aspectLabel(activeBrief.aspect)}
                      </span>
                    </div>
                    {(!isMobile || sheetExpanded) && (
                      <>
                        <p className="mt-1 text-[12px] leading-snug text-[var(--ink-2)]">
                          {activeBrief.tip}
                        </p>
                        <p className="mt-1 text-[11px] text-[var(--accent)]">
                          {activeBrief.clubHint}
                        </p>
                      </>
                    )}
                    <div className="mt-2 grid grid-cols-4 gap-1 text-center">
                      <div className="rounded-md bg-black/25 px-1 py-1">
                        <div className="text-[9px] uppercase tracking-wide text-[var(--ink-4)]">
                          {activeBrief.headwindMph >= 0 ? 'Into' : 'Helping'}
                        </div>
                        <div className="text-[12px] font-semibold tabular-nums text-[var(--ink-1)]">
                          {Math.abs(Math.round(activeBrief.headwindMph))} mph
                        </div>
                      </div>
                      <div className="rounded-md bg-black/25 px-1 py-1">
                        <div className="text-[9px] uppercase tracking-wide text-[var(--ink-4)]">
                          Slope
                        </div>
                        <div className="text-[11px] font-semibold tabular-nums text-[var(--ink-1)]">
                          {activeBrief.slopeYards > 0 ? '+' : ''}
                          {activeBrief.slopeYards} yd
                        </div>
                      </div>
                      <div className="rounded-md bg-black/25 px-1 py-1">
                        <div className="text-[9px] uppercase tracking-wide text-[var(--ink-4)]">
                          Drift
                        </div>
                        <div className="text-[11px] font-semibold tabular-nums text-[var(--ink-1)]">
                          {Math.abs(activeBrief.driftYards)} yd{' '}
                          {activeBrief.driftYards >= 0 ? 'R' : 'L'}
                        </div>
                      </div>
                      <div className="rounded-md bg-black/25 px-1 py-1">
                        <div className="text-[9px] uppercase tracking-wide text-[var(--ink-4)]">
                          Plays vs {activeBrief.yards}
                        </div>
                        <div className="text-[12px] font-semibold tabular-nums text-[var(--ink-1)]">
                          {activeBrief.playsLikeYards}
                          <span className="ml-0.5 text-[10px] font-medium text-[var(--accent)]">
                            {activeBrief.playsLikeYards - activeBrief.yards > 0
                              ? '+'
                              : ''}
                            {activeBrief.playsLikeYards - activeBrief.yards}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {forecast && (!isMobile || sheetExpanded) && (
                  <GolfHoleIntel
                    forecast={forecast}
                    turf={turf}
                    miss={profile.miss}
                  />
                )}

                {(!isMobile || sheetExpanded) && (
                  <>
                    {isMobile ? hourSlider : null}
                    <ul className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                      {playHoles.map((h) => {
                        const brief = briefByHole.get(h.number);
                        const on = activeHole === h.number;
                        const teeCount = teesOnHole(h).length;
                        const teeLabel = pickTee(h, teeKind).label;
                        return (
                          <li key={`${h.loop ?? ''}-${h.number}`}>
                            <button
                              type="button"
                              onClick={() => {
                                setActiveHole(h.number);
                                if (isMobile) setSheetExpanded(false);
                              }}
                              className={[
                                'flex w-full items-start gap-2 px-3 py-2.5 text-left transition-colors md:py-2',
                                on ? 'bg-white/10' : 'hover:bg-white/5',
                              ].join(' ')}
                            >
                              <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md bg-black/30 text-[11px] font-semibold tabular-nums text-[var(--ink-1)]">
                                {h.number}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="flex flex-wrap items-baseline gap-x-2 text-[12px] text-[var(--ink-1)]">
                                  <span className="font-medium tabular-nums">
                                    {h.yards} yd
                                    {brief && brief.playsLikeYards !== h.yards
                                      ? ` · plays ${brief.playsLikeYards} (${brief.playsLikeYards - h.yards > 0 ? '+' : ''}${brief.playsLikeYards - h.yards})`
                                      : brief
                                        ? ' · plays even'
                                        : ''}
                                  </span>
                                  <span className="text-[10px] text-[var(--ink-3)]">
                                    {h.bearingDeg}°{' '}
                                    {bearingCompass(h.bearingDeg)}
                                  </span>
                                  {h.par != null && (
                                    <span className="text-[10px] text-[var(--ink-4)]">
                                      par {h.par}
                                    </span>
                                  )}
                                  {teeCount > 1 && (
                                    <span className="text-[10px] text-[var(--ink-4)]">
                                      {teeLabel}
                                      {teeCount > 2 ? ` · ${teeCount} tees` : ''}
                                    </span>
                                  )}
                                </span>
                                {brief && (
                                  <span className="mt-0.5 block truncate text-[10px] text-[var(--ink-3)]">
                                    · {brief.recommendedClub} · {brief.aspect} ·{' '}
                                    {Math.round(brief.windMph)} mph
                                  </span>
                                )}
                              </span>
                              <Navigation
                                className="mt-1 h-3.5 w-3.5 shrink-0 text-[var(--ink-4)]"
                                style={{
                                  transform: `rotate(${h.bearingDeg}deg)`,
                                }}
                              />
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </>
                )}

                {ensemble && (!isMobile || sheetExpanded) && (
                  <div className="border-t border-[var(--line-subtle)] px-3 py-2 text-[10px] text-[var(--ink-4)]">
                    {ensemble.ensemble.modelsUsed.length} models · OSM +
                    Open-Meteo elevation · Esri imagery
                  </div>
                )}
              </GlassPanel>
            </div>
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 bg-[var(--surface-0)] px-6 text-center">
            <Flag className="h-8 w-8 text-[var(--ink-4)]" />
            <p className="max-w-sm text-sm text-[var(--ink-2)]">
              Pick a course to open high-detail satellite imagery, hole
              yardages &amp; bearings from OpenStreetMap, then an
              all-model wind ensemble hole by hole.
            </p>
          </div>
        )}
      </div>
      {bookOpen && course && profile ? (
        <GolfYardageBook
          course={course}
          profile={profile}
          notebook={notebook}
          loading={notebookLoading}
          error={notebookError}
          onClose={() => setBookOpen(false)}
        />
      ) : null}

    </div>
  );
}
