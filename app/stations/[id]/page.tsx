"use client";

import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  CircleHelp,
  CircleX,
  Clock3,
  Info,
  MapPin,
  MapPinOff,
  Navigation,
  RefreshCw,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { DynamicStationMap } from "@/components/map/dynamic-station-map";
import { PublicHeader } from "@/components/shell/public-header";
import { PublicFooter } from "@/components/shell/public-footer";
import {
  availableCount,
  statusLabels,
  type Availability,
  type Bin,
  type CategorySlug,
  type Station,
} from "@/lib/categories";
import { fetchLiveStations } from "@/lib/station-adapter";

const CATEGORY_DOT_COLORS: Record<CategorySlug, string> = {
  plastic: "#38A6A0",
  paper: "#D49A3A",
  metal: "#71849A",
  general: "#776F68",
};

function CompactStatusPill({
  status,
  hasSensorError,
}: {
  status: Availability;
  hasSensorError?: boolean;
}) {
  if (hasSensorError) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[#FFEDE5] border border-[#FDCBB9] px-2 py-0.5 text-[11px] font-semibold text-[#9A3412] whitespace-nowrap shrink-0">
        <AlertTriangle size={11} />
        Sensor Error
      </span>
    );
  }
  if (status === "available") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[#E6F4EC] border border-[#CBE4D3] px-2 py-0.5 text-[11px] font-semibold text-[#14532D] whitespace-nowrap shrink-0">
        <CheckCircle2 size={11} />
        {statusLabels.available}
      </span>
    );
  }
  if (status === "nearly-full") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[#FFF6E4] border border-[#FDE8BF] px-2 py-0.5 text-[11px] font-semibold text-[#9A6310] whitespace-nowrap shrink-0">
        <AlertTriangle size={11} />
        {statusLabels["nearly-full"]}
      </span>
    );
  }
  if (status === "full") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[#FFF0EE] border border-[#FAD6D2] px-2 py-0.5 text-[11px] font-semibold text-[#B43D38] whitespace-nowrap shrink-0">
        <CircleX size={11} />
        {statusLabels.full}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[#EFF2EF] border border-[#DCE3DC] px-2 py-0.5 text-[11px] font-semibold text-[#606E66] whitespace-nowrap shrink-0">
      <CircleHelp size={11} />
      Unavailable
    </span>
  );
}

function CompactBinCard({ bin }: { bin: Bin }) {
  const hasSensorError = bin.operationalStatus === "SENSOR_ERROR";
  const isOffline =
    hasSensorError ||
    bin.fill === null ||
    bin.fill === undefined ||
    Number.isNaN(bin.fill);
  const fillNum = isOffline ? 0 : Math.min(100, Math.max(0, bin.fill as number));

  const barColor = hasSensorError
    ? "#9A3412"
    : isOffline
      ? "#CBD5E1"
      : fillNum >= 80
        ? "#DC4C46"
        : fillNum >= 50
          ? "#D98A1C"
          : "#14532D";

  const pctTextColor = hasSensorError
    ? "text-[#9A3412]"
    : isOffline
      ? "text-[#65736A]"
      : fillNum >= 80
        ? "text-[#B93832]"
        : fillNum >= 50
          ? "text-[#9A6310]"
          : "text-[#14532D]";

  const timestampLine = hasSensorError
    ? "Sensor error · reading unavailable"
    : bin.status === "unknown"
      ? `${bin.updated === "No reading" ? "No reading" : `Last report ${bin.updated}`} · offline`
      : `Updated ${bin.updated}`;

  return (
    <article className="bg-white rounded-xl border border-[#DCE5DC] p-3.5 flex flex-col justify-between gap-3 shadow-[0_1px_2px_rgba(20,83,45,0.03)] hover:border-[#A9C9B6] transition-colors">
      <div className="space-y-3">
        {/* Top Row: Category dot, title, compact status pill */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="h-2.5 w-2.5 rounded-full shrink-0"
              style={{
                backgroundColor:
                  CATEGORY_DOT_COLORS[bin.category] ?? "#65736A",
              }}
            />
            <div className="min-w-0">
              <h3 className="font-jakarta text-sm font-semibold text-[#14231B] leading-snug truncate">
                {bin.label}
              </h3>
              {bin.readingSource === "SIMULATED" && (
                <span className="mt-0.5 inline-flex items-center rounded-full bg-amber-100 px-1.5 py-0.2 text-[9px] font-bold uppercase tracking-wide text-amber-800">
                  Simulated
                </span>
              )}
            </div>
          </div>

          <CompactStatusPill
            status={bin.status}
            hasSensorError={hasSensorError}
          />
        </div>

        {/* Middle Gauge Box */}
        <div className="p-2.5 rounded-lg bg-slate-50/80 border border-slate-100 space-y-1.5">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[11px] font-medium text-[#65736A]">
              Fill level
            </span>
            <strong
              className={`font-jakarta text-lg font-bold tabular-nums leading-none ${pctTextColor}`}
            >
              {hasSensorError
                ? "N/A"
                : bin.fill === null
                  ? "—"
                  : `${Math.round(fillNum)}%`}
            </strong>
          </div>

          <div className="h-1.5 w-full rounded-full bg-slate-200/80 overflow-hidden">
            {!isOffline && (
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{ width: `${fillNum}%`, backgroundColor: barColor }}
              />
            )}
          </div>

          <p className="text-[11px] text-[#65736A] truncate" title={timestampLine}>
            {timestampLine}
          </p>
        </div>

        {/* Bottom Accepted Examples */}
        {bin.accepts.length > 0 && (
          <div className="space-y-1">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-[#5A6B61]">
              Accepted
            </span>
            <ul className="text-xs space-y-1 text-[#425249]">
              {bin.accepts.map((item) => (
                <li key={item} className="flex items-center gap-1.5">
                  <Check size={12} className="text-[#16A34A] shrink-0" />
                  <span className="truncate">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Category Guide Link */}
      <div className="pt-2 border-t border-[#EDF1ED]">
        <Link
          href={`/sorting-guide?category=${bin.category}`}
          className="inline-flex items-center gap-1 text-xs font-medium text-emerald-800 hover:text-[#0F3F22] transition-colors"
        >
          <span>Category guide</span>
          <ArrowRight size={12} />
        </Link>
      </div>
    </article>
  );
}

export default function StationDetailPage() {
  const params = useParams<{ id: string }>();
  const stationId = params?.id;

  const [station, setStation] = useState<Station | null>(null);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  const loadStation = useCallback(async () => {
    if (!stationId) return;
    setRefreshing(true);
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
        err instanceof Error
          ? err.message
          : "Unable to reach telemetry service",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
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
          err instanceof Error
            ? err.message
            : "Unable to reach telemetry service",
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
    <div className="site-shell min-h-screen flex flex-col bg-[#F8F9F6]">
      <PublicHeader />

      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-4 space-y-5">
        <Link
          href="/find-bin"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#14532D] hover:text-[#0F3F22] mb-2 transition-colors"
        >
          <ArrowLeft size={14} />
          <span>Back to all stations</span>
        </Link>

        {loading && !station ? (
          <div className="py-20 flex flex-col items-center justify-center gap-2 text-[#14532D]">
            <RefreshCw size={20} className="animate-spin" />
            <strong className="text-xs font-semibold">
              Loading station telemetry…
            </strong>
          </div>
        ) : errorMsg && !station ? (
          <div className="bg-white rounded-2xl border border-[#FADAD7] p-8 text-center space-y-2.5 max-w-md mx-auto my-8">
            <AlertCircle size={26} className="text-[#C84F49] mx-auto" />
            <h2 className="font-jakarta text-base font-bold text-[#14231B]">
              Telemetry service unavailable
            </h2>
            <p className="text-xs text-[#65736A]">{errorMsg}</p>
            <button
              type="button"
              onClick={loadStation}
              className="mt-2 inline-flex items-center gap-1.5 h-9 px-4 rounded-full bg-[#14532D] text-white text-xs font-semibold hover:bg-[#0F3F22] transition-colors"
            >
              <RefreshCw size={13} />
              Retry connection
            </button>
          </div>
        ) : notFound || !station ? (
          <div className="bg-white rounded-2xl border border-[#DCE5DC] p-8 text-center space-y-2.5 max-w-md mx-auto my-8">
            <MapPinOff size={26} className="text-[#8B9A91] mx-auto" />
            <h2 className="font-jakarta text-base font-bold text-[#14231B]">
              Station not found
            </h2>
            <p className="text-xs text-[#65736A]">
              No active station matched identifier &ldquo;{stationId}&rdquo;.
            </p>
            <Link
              href="/find-bin"
              className="mt-2 inline-flex items-center justify-center h-9 px-4 rounded-full bg-[#14532D] text-white text-xs font-semibold hover:bg-[#0F3F22] transition-colors"
            >
              Return to locator
            </Link>
          </div>
        ) : (
          <>
            {/* Compact Station Hero Header Card */}
            <section className="bg-white rounded-2xl border border-[#DCE5DC] p-4 sm:p-5 shadow-[0_1px_3px_rgba(20,83,45,0.03)] flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex-1 min-w-0 space-y-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#EAF4ED] border border-[#D1E6D7] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#14532D]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#16A34A]" />
                    Station {station.id} · Live telemetry
                  </span>
                  <span className="inline-flex items-center rounded-full bg-[#F3F6F3] border border-[#E2E8E2] px-2.5 py-0.5 text-[11px] font-semibold text-[#47574E]">
                    {availableCount(station)} of {station.bins.length} bins
                    available
                  </span>
                </div>

                <div>
                  <h1 className="font-jakarta text-xl sm:text-2xl font-bold leading-snug tracking-tight text-[#14231B]">
                    {station.name}
                    {station.landmark ? (
                      <span className="text-[#14532D]">
                        {" "}
                        — {station.landmark}
                      </span>
                    ) : null}
                  </h1>

                  <div className="text-xs text-slate-500 mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1">
                    {station.description && <span>{station.description}</span>}
                    {station.description && (
                      <span className="text-slate-300">•</span>
                    )}
                    {station.hasValidCoordinates && station.coordinates ? (
                      <span className="inline-flex items-center gap-1 font-mono text-[11px]">
                        <MapPin size={12} className="text-[#14532D]" />
                        {station.coordinates[0].toFixed(4)},{" "}
                        {station.coordinates[1].toFixed(4)}
                      </span>
                    ) : (
                      <span className="text-[#B47010] font-medium">
                        Location not calibrated
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-0.5">
                  {station.hasValidCoordinates && station.coordinates ? (
                    <a
                      href={`https://www.openstreetmap.org/directions?to=${station.coordinates[0]},${station.coordinates[1]}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full bg-[#14532D] hover:bg-[#0F3F22] text-white text-xs font-semibold transition-colors shadow-xs"
                    >
                      <Navigation size={13} />
                      <span>Get Directions</span>
                    </a>
                  ) : (
                    <button
                      type="button"
                      disabled
                      title="Coordinates unavailable"
                      className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full border border-[#DCE5DC] bg-[#F5F7F5] text-xs font-semibold text-[#8A9890] cursor-not-allowed"
                    >
                      <Navigation size={13} />
                      <span>Directions unavailable</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={loadStation}
                    disabled={refreshing}
                    className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full border border-[#DCE5DC] bg-white hover:bg-[#F3F7F4] text-[#14532D] text-xs font-semibold transition-colors disabled:opacity-60"
                  >
                    <RefreshCw
                      size={13}
                      className={refreshing ? "animate-spin" : ""}
                    />
                    <span>{refreshing ? "Refreshing…" : "Refresh status"}</span>
                  </button>
                </div>
              </div>

              {/* Compact Mini-Map */}
              <div className="relative h-[170px] sm:h-[185px] w-full lg:w-[320px] shrink-0 rounded-xl overflow-hidden border border-[#DCE5DC] bg-[#E5EAE5]">
                {station.hasValidCoordinates ? (
                  <DynamicStationMap
                    stations={[station]}
                    selected={station}
                    category="all"
                    onSelect={() => undefined}
                  />
                ) : (
                  <div className="h-full w-full flex flex-col items-center justify-center bg-[#F7F8F4] text-[#65736A] text-xs gap-1.5 p-4 text-center">
                    <MapPinOff size={20} className="text-[#C48419]" />
                    <strong className="font-semibold text-[#1A2620]">
                      Location not calibrated
                    </strong>
                    <span className="text-[11px]">
                      GPS coordinates have not been registered yet.
                    </span>
                  </div>
                )}
              </div>
            </section>

            {/* 4-Column Compact Compartment Grid */}
            <section className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="font-jakarta text-lg sm:text-xl font-bold text-[#14231B]">
                    Bins at this station
                  </h2>
                  <p className="text-xs text-[#617067]">
                    Live compartment telemetry with offline or stale sensors
                    marked unavailable.
                  </p>
                </div>

                <span className="inline-flex items-center gap-1.5 rounded-full bg-white border border-[#DCE5DC] px-3 py-1 text-xs font-medium text-[#55655C]">
                  <Clock3 size={13} className="text-[#14532D]" />
                  <span>Updated {fetchedAt ?? "moments ago"}</span>
                </span>
              </div>

              {station.floors && station.floors.length > 0 ? (
                <div className="space-y-5">
                  {station.floors.map((floor) =>
                    floor.areas.length === 0 ? (
                      <div
                        key={floor.id}
                        className="rounded-xl bg-white border border-[#E1E8E1] p-4 text-xs text-[#65736A]"
                      >
                        <strong className="text-[#14231B]">{floor.name}</strong>{" "}
                        — No active disposal areas configured on this floor.
                      </div>
                    ) : (
                      floor.areas.map((area) => (
                        <div
                          key={`${floor.id}-${area.id}`}
                          className="space-y-3"
                        >
                          {/* Merged inline floor • zone subheader */}
                          <div className="flex flex-wrap items-center justify-between gap-2 pb-1.5 border-b border-[#E2EAE2]">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="inline-flex items-center rounded-md bg-[#EBF4EE] px-2 py-0.5 text-xs font-medium text-[#14532D]">
                                {floor.name} • {area.name}
                              </span>
                              {area.description && (
                                <span className="text-xs text-[#65736A]">
                                  {area.description}
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] font-medium text-[#65736A]">
                              {area.bins.length}{" "}
                              {area.bins.length === 1 ? "bin" : "bins"}
                            </span>
                          </div>

                          {area.bins.length === 0 ? (
                            <p className="text-xs text-[#65736A]">
                              No active bins configured in this area.
                            </p>
                          ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                              {area.bins.map((bin) => (
                                <CompactBinCard key={bin.id} bin={bin} />
                              ))}
                            </div>
                          )}
                        </div>
                      ))
                    ),
                  )}
                </div>
              ) : station.bins.length === 0 ? (
                <div className="bg-white rounded-2xl border border-[#DCE5DC] p-8 text-center space-y-1.5">
                  <h3 className="font-jakarta text-sm font-bold text-[#14231B]">
                    No bins configured
                  </h3>
                  <p className="text-xs text-[#65736A]">
                    This station does not currently have active bins assigned.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                  {station.bins.map((bin) => (
                    <CompactBinCard key={bin.id} bin={bin} />
                  ))}
                </div>
              )}
            </section>

            {/* Compact Telemetry Notice */}
            <aside className="rounded-xl bg-[#EDF4EF] border border-[#DCE8E0] px-4 py-3 flex items-start gap-2.5 text-xs text-[#4C6156]">
              <Info size={16} className="text-[#14532D] shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                <strong className="font-semibold text-[#14231B]">
                  Live station telemetry:
                </strong>{" "}
                Fill percentages and online status are reported directly by the
                SortSense Cloud API. Always confirm physical compartment labels
                before disposal.
              </p>
            </aside>
          </>
        )}
      </main>

      <PublicFooter />
    </div>
  );
}
