'use client';

import {
  AlertCircle,
  ArrowLeft,
  Check,
  Clock3,
  Info,
  MapPinOff,
  Navigation,
  RefreshCw,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { DynamicStationMap } from '@/components/map/dynamic-station-map';
import { StatusBadge } from '@/components/ui/status-badge';
import { PublicHeader } from '@/components/shell/public-header';
import { PublicFooter } from '@/components/shell/public-footer';
import type { Station } from '@/lib/categories';
import { fetchLiveStations } from '@/lib/station-adapter';

export default function StationDetailPage() {
  const params = useParams<{ id: string }>();
  const stationId = params?.id;

  const [station, setStation] = useState<Station | null>(null);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  const loadStation = useCallback(async () => {
    if (!stationId) return;
    setLoading(true);
    setErrorMsg(null);
    setNotFound(false);
    try {
      const result = await fetchLiveStations(null);
      const found = result.stations.find((s) => s.id === stationId);
      if (!found) {
        setNotFound(true);
        setStation(null);
      } else {
        setStation(found);
        setFetchedAt(new Date(result.fetchedAt).toLocaleTimeString());
      }
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Unable to reach telemetry service',
      );
    } finally {
      setLoading(false);
    }
  }, [stationId]);

  useEffect(() => {
    if (!stationId) return;
    let active = true;
    async function init() {
      try {
        const result = await fetchLiveStations(null);
        if (!active) return;
        const found = result.stations.find((s) => s.id === stationId);
        if (!found) {
          setNotFound(true);
          setStation(null);
        } else {
          setStation(found);
          setFetchedAt(new Date(result.fetchedAt).toLocaleTimeString());
        }
      } catch (err) {
        if (!active) return;
        setErrorMsg(
          err instanceof Error ? err.message : 'Unable to reach telemetry service',
        );
      } finally {
        if (active) setLoading(false);
      }
    }
    init();
    return () => {
      active = false;
    };
  }, [stationId]);

  return (
    <div className="site-shell">
      <PublicHeader />

      <main className="station-page page-width">
        <Link className="back-link" href="/find-bin">
          <ArrowLeft size={16} /> Back to all stations
        </Link>

        {loading && !station ? (
          <div className="route-loading" style={{ minHeight: '50vh' }}>
            <span />
            <strong>Loading station telemetry…</strong>
          </div>
        ) : errorMsg && !station ? (
          <div className="empty-state my-12">
            <AlertCircle />
            <h2>Telemetry service unavailable</h2>
            <p>{errorMsg}</p>
            <button onClick={loadStation}>
              <RefreshCw size={14} className="inline mr-1.5" /> Retry connection
            </button>
          </div>
        ) : notFound || !station ? (
          <div className="empty-state my-12">
            <MapPinOff />
            <h2>Station not found</h2>
            <p>
              No active station matched identifier &ldquo;{stationId}&rdquo;.
            </p>
            <Link
              href="/find-bin"
              className="button button-primary button-compact mt-4"
            >
              Return to locator
            </Link>
          </div>
        ) : (
          <>
            <section className="station-hero">
              <div className="station-title">
                <span className="demo-label">
                  Station {station.id} · Live telemetry
                </span>
                <h1>
                  {station.name}
                  {station.landmark ? <em> — {station.landmark}</em> : null}
                </h1>
                {station.description && <p>{station.description}</p>}

                <div className="station-meta">
                  {station.hasValidCoordinates && station.coordinates ? (
                    <span>
                      Coordinates: {station.coordinates[0].toFixed(4)},{' '}
                      {station.coordinates[1].toFixed(4)}
                    </span>
                  ) : (
                    <span className="text-[#c48419]">
                      Location not calibrated
                    </span>
                  )}
                </div>

                <div className="station-title-actions">
                  {station.hasValidCoordinates && station.coordinates ? (
                    <a
                      className="button button-primary"
                      href={`https://www.openstreetmap.org/directions?to=${station.coordinates[0]},${station.coordinates[1]}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <Navigation size={16} /> Get Directions
                    </a>
                  ) : (
                    <button
                      className="button button-secondary opacity-60 cursor-not-allowed"
                      disabled
                      title="Coordinates unavailable"
                    >
                      <Navigation size={16} /> Directions unavailable
                    </button>
                  )}
                  <button
                    className="button button-secondary"
                    onClick={loadStation}
                  >
                    <RefreshCw size={16} /> Refresh status
                  </button>
                </div>
              </div>

              <div className="station-mini-map">
                {station.hasValidCoordinates ? (
                  <DynamicStationMap
                    stations={[station]}
                    selected={station}
                    category="all"
                    onSelect={() => undefined}
                  />
                ) : (
                  <div className="station-map flex flex-col items-center justify-center bg-[#f7f8f4] text-[#65736a] text-xs gap-2 p-6 text-center">
                    <MapPinOff size={24} className="text-[#c48419]" />
                    <strong>Location not calibrated</strong>
                    <span>
                      GPS coordinates have not been registered for this station.
                    </span>
                  </div>
                )}
              </div>
            </section>

            <section className="bins-section">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">Live-state telemetry</span>
                  <h2>Bins at this station</h2>
                  <p>
                    Status labels are given priority over percentages, with
                    offline or stale readings shown as unavailable.
                  </p>
                </div>
                <span className="last-refresh">
                  <Clock3 size={15} /> Updated {fetchedAt ?? 'moments ago'}
                </span>
              </div>

              {station.floors && station.floors.length > 0 ? (
                <div className="space-y-8">
                  {station.floors.map((floor) => (
                    <div key={floor.id} className="space-y-4">
                      <div className="flex items-center justify-between border-b border-[#E1E8E1] pb-2">
                        <h3 className="text-lg font-bold text-[#202A25] font-display">
                          {floor.name}
                        </h3>
                        <span className="text-xs text-[#65736A]">
                          {floor.areas.length} disposal {floor.areas.length === 1 ? 'area' : 'areas'}
                        </span>
                      </div>

                      {floor.areas.length === 0 ? (
                        <p className="text-xs text-[#65736A]">
                          No active disposal areas configured on this floor.
                        </p>
                      ) : (
                        <div className="space-y-6">
                          {floor.areas.map((area) => (
                            <div key={area.id} className="space-y-3">
                              <div>
                                <h4 className="text-sm font-bold text-[#176B45] font-display">
                                  {area.name}
                                </h4>
                                {area.description && (
                                  <p className="text-xs text-[#65736A] mt-0.5">
                                    {area.description}
                                  </p>
                                )}
                              </div>

                              {area.bins.length === 0 ? (
                                <p className="text-xs text-[#65736A]">
                                  No active bins configured in this area.
                                </p>
                              ) : (
                                <div className="bin-detail-grid">
                                  {area.bins.map((bin) => (
                                    <article className="bin-detail-card" key={bin.id}>
                                      <div className="bin-detail-head">
                                        <div>
                                          <span className={`category-dot cat-${bin.category}`} />
                                          <div>
                                            <span>
                                              {floor.name} · {area.name}
                                            </span>
                                            <h3>{bin.label}</h3>
                                            {bin.readingSource === 'SIMULATED' && (
                                              <span className="mt-1 inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
                                                Simulated (Test Data)
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                        <StatusBadge status={bin.status} />
                                      </div>
                                      <div className="fill-reading">
                                        <div>
                                          <span>Estimated fill level</span>
                                          <strong>
                                            {bin.operationalStatus === 'SENSOR_ERROR'
                                              ? 'N/A'
                                              : bin.fill === null
                                                ? '—'
                                                : `${bin.fill}%`}
                                          </strong>
                                        </div>
                                        <div className="progress-track">
                                          <i
                                            className={`fill-${bin.status}`}
                                            style={{ width: `${bin.fill ?? 0}%` }}
                                          />
                                        </div>
                                        <small>
                                          {bin.operationalStatus === 'SENSOR_ERROR'
                                            ? 'Sensor error · reading unavailable'
                                            : bin.status === 'unknown'
                                              ? `${bin.updated === 'No reading' ? 'No reading' : `Last report ${bin.updated}`} · station offline or reading unavailable`
                                              : `Updated ${bin.updated}`}
                                        </small>
                                      </div>
                                      {bin.accepts.length > 0 && (
                                        <div className="accepted-items">
                                          <strong>Accepted examples</strong>
                                          {bin.accepts.map((item) => (
                                            <span key={item}>
                                              <Check size={13} /> {item}
                                            </span>
                                          ))}
                                        </div>
                                      )}
                                      <Link href={`/sorting-guide?category=${bin.category}`}>
                                        View category guidance
                                      </Link>
                                    </article>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : station.bins.length === 0 ? (
                <div className="empty-state">
                  <h2>No bins configured</h2>
                  <p>This station does not currently have active bins assigned.</p>
                </div>
              ) : (
                <div className="bin-detail-grid">
                  {station.bins.map((bin) => (
                    <article className="bin-detail-card" key={bin.id}>
                      <div className="bin-detail-head">
                        <div>
                          <span className={`category-dot cat-${bin.category}`} />
                          <div>
                            <span>{bin.id}</span>
                            <h3>{bin.label}</h3>
                          </div>
                        </div>
                        <StatusBadge status={bin.status} />
                      </div>
                      <div className="fill-reading">
                        <div>
                          <span>Estimated fill level</span>
                          <strong>
                            {bin.fill === null ? '—' : `${bin.fill}%`}
                          </strong>
                        </div>
                        <div className="progress-track">
                          <i
                            className={`fill-${bin.status}`}
                            style={{ width: `${bin.fill ?? 0}%` }}
                          />
                        </div>
                        <small>
                          {bin.status === 'unknown'
                            ? `Last report ${bin.updated} · station offline or reading unavailable`
                            : `Updated ${bin.updated}`}
                        </small>
                      </div>
                      <div className="accepted-items">
                        <strong>Accepted examples</strong>
                        {bin.accepts.map((item) => (
                          <span key={item}>
                            <Check size={13} /> {item}
                          </span>
                        ))}
                      </div>
                      <Link href={`/sorting-guide?category=${bin.category}`}>
                        View category guidance
                      </Link>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <aside className="prototype-callout">
              <Info size={20} />
              <div>
                <strong>Live station telemetry</strong>
                <p>
                  Fill percentages and station online status are reported
                  directly by the SortSense Cloud API. Always check physical bin
                  labels before disposal.
                </p>
              </div>
            </aside>
          </>
        )}
      </main>

      <PublicFooter />
    </div>
  );
}
