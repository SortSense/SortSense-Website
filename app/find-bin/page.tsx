'use client';

import {
  AlertCircle,
  ArrowDownUp,
  ArrowRight,
  Check,
  ChevronDown,
  Crosshair,
  Info,
  ListFilter,
  Loader2,
  MapPin,
  Navigation,
  RefreshCw,
  Search,
  SlidersHorizontal,
} from 'lucide-react';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { DynamicStationMap } from '@/components/map/dynamic-station-map';
import { StatusBadge } from '@/components/ui/status-badge';
import { PublicHeader } from '@/components/shell/public-header';
import {
  availableCount,
  categories,
  type CategorySlug,
} from '@/lib/categories';
import { adaptStation } from '@/lib/station-adapter';
import type { LiveStatusResponse, StationLiveStatus } from '@/components/types';

function LocatorContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const searchInputRef = useRef<HTMLInputElement>(null);

  const initialCategory = searchParams.get('category') as CategorySlug | null;
  const [category, setCategory] = useState<CategorySlug | 'all'>(
    categories.some((item) => item.slug === initialCategory)
      ? initialCategory!
      : 'all',
  );

  const [rawStations, setRawStations] = useState<StationLiveStatus[]>([]);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isStale, setIsStale] = useState(false);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<'nearest' | 'availability'>('nearest');

  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);

  const loadStations = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/dashboard/live-status', { cache: 'no-store' });
      if (!res.ok) {
        throw new Error(`Telemetry service returned HTTP ${res.status}`);
      }
      const data: LiveStatusResponse = await res.json();
      const list = Array.isArray(data.stations) ? data.stations : [];
      setRawStations(list);
      setFetchedAt(new Date().toLocaleTimeString());
      setIsStale(false);
      setSelectedId((prev) => prev ?? list[0]?.station_id ?? null);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unable to reach telemetry service';
      setErrorMsg(message);
      if (rawStations.length > 0) {
        setIsStale(true);
      }
    } finally {
      setLoading(false);
    }
  }, [rawStations.length]);

  // Initial fetch on mount
  useEffect(() => {
    let active = true;
    async function init() {
      setLoading(true);
      setErrorMsg(null);
      try {
        const res = await fetch('/api/dashboard/live-status', { cache: 'no-store' });
        if (!res.ok) {
          throw new Error(`Telemetry service returned HTTP ${res.status}`);
        }
        const data: LiveStatusResponse = await res.json();
        if (!active) return;
        const list = Array.isArray(data.stations) ? data.stations : [];
        setRawStations(list);
        setFetchedAt(new Date().toLocaleTimeString());
        setIsStale(false);
        setSelectedId((prev) => prev ?? list[0]?.station_id ?? null);
      } catch (err) {
        if (!active) return;
        const message =
          err instanceof Error ? err.message : 'Unable to reach telemetry service';
        setErrorMsg(message);
      } finally {
        if (active) setLoading(false);
      }
    }
    init();
    return () => {
      active = false;
    };
  }, []);

  // Cmd/Ctrl+K shortcut to focus search
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const stations = useMemo(
    () => rawStations.map((s) => adaptStation(s, userLocation)),
    [rawStations, userLocation],
  );

  const selected = useMemo(
    () => stations.find((s) => s.id === selectedId) ?? stations[0] ?? null,
    [stations, selectedId],
  );

  const filtered = useMemo(() => {
    const result = stations.filter((station) => {
      const matchesSearch = `${station.name} ${station.landmark ?? ''}`
        .toLowerCase()
        .includes(query.toLowerCase());
      return (
        matchesSearch &&
        (category === 'all' ||
          station.bins.some((bin) => bin.category === category))
      );
    });

    return [...result].sort((a, b) => {
      if (sort === 'availability') {
        return availableCount(b) - availableCount(a);
      }
      if (category !== 'all') {
        const aBin = a.bins.find((bin) => bin.category === category);
        const bBin = b.bins.find((bin) => bin.category === category);
        const rank = { available: 0, 'nearly-full': 1, unknown: 2, full: 3 };
        if (aBin && bBin && rank[aBin.status] !== rank[bBin.status]) {
          return rank[aBin.status] - rank[bBin.status];
        }
      }
      if (a.distance !== undefined && b.distance !== undefined) {
        return a.distance - b.distance;
      }
      if (a.distance !== undefined) return -1;
      if (b.distance !== undefined) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [stations, category, query, sort]);

  const recommendation = filtered.find((station) =>
    category === 'all'
      ? availableCount(station) > 0
      : station.bins.find((bin) => bin.category === category)?.status ===
        'available',
  );

  const changeCategory = (value: CategorySlug | 'all') => {
    setCategory(value);
    if (value === 'all') {
      router.replace('/find-bin');
    } else {
      router.replace(`/find-bin?category=${value}`);
    }
  };

  const toggleNearMe = () => {
    setLocationError(null);
    if (userLocation) {
      setUserLocation(null);
      return;
    }
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation([pos.coords.latitude, pos.coords.longitude]);
        setLocating(false);
      },
      (err) => {
        setLocationError(
          err.code === err.PERMISSION_DENIED
            ? 'Location permission denied. Distances remain unavailable.'
            : 'Unable to determine your current location.',
        );
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  return (
    <main className="locator-page">
      <div className="locator-header page-width">
        <div>
          <span className="demo-label">
            Live campus telemetry {fetchedAt ? `· Updated ${fetchedAt}` : ''}
          </span>
          <h1>Find the right bin nearby.</h1>
          <p>
            Choose what you’re disposing of, then compare suitability and
            availability.
          </p>
        </div>
        <div className="location-state">
          <Info size={16} />
          <span>
            {locationError
              ? locationError
              : userLocation
                ? 'Showing distances from your current GPS location.'
                : 'Enable Near Me to calculate walking distances from your location.'}
          </span>
        </div>
      </div>

      <div className="locator-toolbar page-width">
        <label className="search-field">
          <Search size={19} />
          <input
            ref={searchInputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search a building or station name..."
          />
          <span className="key-hint">⌘ K</span>
        </label>
        <button
          className={`button near-me ${userLocation ? 'active' : ''}`}
          onClick={toggleNearMe}
          disabled={locating}
        >
          {locating ? (
            <Loader2 size={17} className="animate-spin" />
          ) : (
            <Crosshair size={17} />
          )}{' '}
          {userLocation ? 'Near Me On' : 'Near Me'}
        </button>
      </div>

      <div
        className="category-bar page-width"
        aria-label="Waste category filters"
      >
        <button
          className={category === 'all' ? 'active' : ''}
          onClick={() => changeCategory('all')}
        >
          <ListFilter size={15} /> All waste
        </button>
        {categories.map((item) => (
          <button
            className={category === item.slug ? 'active' : ''}
            key={item.slug}
            onClick={() => changeCategory(item.slug)}
          >
            <span style={{ background: item.color }} /> {item.name}
          </button>
        ))}
      </div>

      {errorMsg && rawStations.length === 0 ? (
        <section className="page-width py-12">
          <div className="empty-state">
            <AlertCircle />
            <h2>Telemetry service unavailable</h2>
            <p>{errorMsg}</p>
            <button onClick={loadStations}>
              <RefreshCw size={14} className="inline mr-1.5" /> Retry connection
            </button>
          </div>
        </section>
      ) : (
        <section className="locator-workspace">
          <div className="station-panel">
            <div className="panel-summary">
              <div>
                <strong>
                  {loading && stations.length === 0
                    ? 'Loading stations…'
                    : `${filtered.length} stations`}
                </strong>
                <span>
                  {isStale && fetchedAt
                    ? `Offline · Last updated ${fetchedAt}`
                    : 'Live campus telemetry'}
                </span>
              </div>
              <label>
                <ArrowDownUp size={14} />
                <select
                  value={sort}
                  onChange={(event) =>
                    setSort(event.target.value as 'nearest' | 'availability')
                  }
                >
                  <option value="nearest">
                    {userLocation ? 'Nearest first' : 'Default order'}
                  </option>
                  <option value="availability">Best availability</option>
                </select>
                <ChevronDown size={13} />
              </label>
            </div>

            {isStale && errorMsg && (
              <div className="mx-3 mt-2 p-2.5 rounded-xl bg-[#fff6e4] border border-[#fde8bf] text-xs text-[#c48419] flex items-center justify-between gap-2">
                <span>Offline: showing data from {fetchedAt}</span>
                <button
                  onClick={loadStations}
                  className="font-bold underline shrink-0"
                >
                  Retry
                </button>
              </div>
            )}

            <div className="station-scroll">
              {recommendation && (
                <article className="recommendation-card">
                  <span className="recommendation-label">
                    <Check size={13} /> Recommended
                    {category !== 'all' ? ` for ${category}` : ''}
                  </span>
                  <h2>
                    {recommendation.name}
                    {recommendation.landmark
                      ? ` — ${recommendation.landmark}`
                      : ''}
                  </h2>
                  {recommendation.distance !== undefined &&
                  recommendation.walkTime !== undefined ? (
                    <p>
                      {recommendation.distance} m away ·{' '}
                      {recommendation.walkTime} min walk
                    </p>
                  ) : (
                    <p>
                      {recommendation.hasValidCoordinates
                        ? 'Confirmed available bin'
                        : 'Location not calibrated'}
                    </p>
                  )}
                  <strong>
                    Station with a confirmed available option.
                  </strong>
                  <button
                    onClick={() => setSelectedId(recommendation.id)}
                  >
                    {recommendation.hasValidCoordinates
                      ? 'View on map'
                      : 'Select station'}{' '}
                    <ArrowRight size={15} />
                  </button>
                </article>
              )}

              {filtered.map((station) => {
                const relevant =
                  category === 'all'
                    ? station.bins
                    : station.bins.filter((bin) => bin.category === category);
                return (
                  <article
                    className={`station-card ${
                      selected?.id === station.id ? 'selected' : ''
                    }`}
                    key={station.id}
                    onClick={() => setSelectedId(station.id)}
                  >
                    <div className="station-card-head">
                      <div>
                        <span className="station-pin">
                          <MapPin size={17} />
                        </span>
                        <div>
                          <h2>{station.name}</h2>
                          {station.landmark && <p>{station.landmark}</p>}
                        </div>
                      </div>
                      {!station.hasValidCoordinates ? (
                        <span className="distance-label text-[#c48419] bg-[#fff6e4]">
                          Location not calibrated
                        </span>
                      ) : station.distance !== undefined ? (
                        <span className="distance-label">
                          {station.distance} m
                        </span>
                      ) : null}
                    </div>
                    <div className="availability-summary">
                      <strong>
                        {availableCount(station)} of {station.bins.length} bins
                        available
                      </strong>
                      <span>
                        {station.walkTime !== undefined
                          ? `${station.walkTime} min walk · `
                          : ''}
                        {station.bins.length} categories
                      </span>
                    </div>
                    <div className="mini-bin-list">
                      {relevant.slice(0, 3).map((bin) => (
                        <div key={bin.id}>
                          <span>{bin.label}</span>
                          <StatusBadge status={bin.status} />
                        </div>
                      ))}
                    </div>
                    <div className="station-actions">
                      <Link href={`/stations/${station.id}`}>
                        View details
                      </Link>
                      {station.hasValidCoordinates && station.coordinates ? (
                        <a
                          href={`https://www.openstreetmap.org/directions?to=${station.coordinates[0]},${station.coordinates[1]}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <Navigation size={14} /> Directions
                        </a>
                      ) : (
                        <span
                          className="opacity-50 cursor-not-allowed inline-flex items-center gap-1.5 text-xs font-semibold text-[#65736a]"
                          title="Coordinates unavailable"
                        >
                          <Navigation size={14} /> Directions unavailable
                        </span>
                      )}
                    </div>
                  </article>
                );
              })}

              {!loading && !filtered.length && (
                <div className="empty-state">
                  <SlidersHorizontal />
                  <h2>No stations found in this area.</h2>
                  <p>Clear your search or choose another category.</p>
                  <button
                    onClick={() => {
                      setQuery('');
                      changeCategory('all');
                    }}
                  >
                    Clear filters
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="map-panel">
            <DynamicStationMap
              stations={filtered.length ? filtered : stations}
              selected={selected}
              category={category}
              onSelect={(st) => setSelectedId(st.id)}
              userLocation={userLocation}
            />
            <div className="map-demo-notice">
              {isStale
                ? `Offline · Last updated ${fetchedAt}`
                : 'Live station telemetry'}
            </div>
            {selected && (
              <div className="map-selected-preview">
                <span>
                  <MapPin size={16} />
                </span>
                <div>
                  <strong>{selected.name}</strong>
                  <small>
                    {!selected.hasValidCoordinates
                      ? 'Location not calibrated'
                      : selected.distance !== undefined
                        ? `${selected.distance} m away`
                        : `${availableCount(selected)} of ${selected.bins.length} bins available`}
                  </small>
                </div>
                <Link href={`/stations/${selected.id}`}>
                  Details <ArrowRight size={14} />
                </Link>
              </div>
            )}
          </div>
        </section>
      )}
    </main>
  );
}

export default function FindBinPage() {
  return (
    <div className="site-shell">
      <PublicHeader />
      <Suspense
        fallback={
          <div className="route-loading">
            <span />
            <strong>Loading SortSense Locator…</strong>
          </div>
        }
      >
        <LocatorContent />
      </Suspense>
    </div>
  );
}
