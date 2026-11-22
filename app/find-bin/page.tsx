"use client";

import {
  AlertCircle,
  AlertTriangle,
  ArrowDownUp,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  CircleX,
  Crosshair,
  Info,
  ListFilter,
  Loader2,
  MapPin,
  Navigation,
  RefreshCw,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { DynamicStationMap } from "@/components/map/dynamic-station-map";
import { PublicHeader } from "@/components/shell/public-header";
import {
  availableCount,
  categories,
  statusLabels,
  type Availability,
  type CategorySlug,
  type Station,
} from "@/lib/categories";
import { adaptStation } from "@/lib/station-adapter";
import type { LiveStatusResponse, StationLiveStatus } from "@/components/types";

const categoryColorMap: Record<CategorySlug, string> = {
  plastic: "#38A6A0",
  paper: "#D49A3A",
  metal: "#71849A",
  general: "#776F68",
};

const statusRank: Record<Availability, number> = {
  available: 0,
  "nearly-full": 1,
  unknown: 2,
  full: 3,
};

interface CategoryStatusRow {
  key: string;
  label: string;
  color: string;
  status: Availability;
  meta: string | null;
}

function getStationCategoryRows(
  station: Station,
  activeCategory: CategorySlug | "all",
): CategoryStatusRow[] {
  const relevant =
    activeCategory === "all"
      ? station.bins
      : station.bins.filter((bin) => bin.category === activeCategory);

  if (relevant.length <= 4) {
    return relevant.map((bin) => ({
      key: bin.id,
      label: bin.label,
      color: categoryColorMap[bin.category] ?? "#65736A",
      status: bin.status,
      meta:
        typeof bin.fill === "number" && Number.isFinite(bin.fill)
          ? `${Math.round(bin.fill)}%`
          : null,
    }));
  }

  // Group multi-floor bins by waste category so each card stays concise
  const targetCategories =
    activeCategory === "all"
      ? categories
      : categories.filter((c) => c.slug === activeCategory);

  return targetCategories
    .map((cat): CategoryStatusRow | null => {
      const catBins = relevant.filter((b) => b.category === cat.slug);
      if (catBins.length === 0) return null;
      const bestStatus = catBins.reduce<Availability>(
        (best, bin) =>
          statusRank[bin.status] < statusRank[best] ? bin.status : best,
        catBins[0].status,
      );
      const openCount = catBins.filter((b) => b.status === "available").length;
      return {
        key: `${station.id}-${cat.slug}`,
        label: cat.name,
        color: cat.color,
        status: bestStatus,
        meta: `${openCount}/${catBins.length} open`,
      };
    })
    .filter((row): row is CategoryStatusRow => row !== null);
}

function BinAvailabilityBadge({ status }: { status: Availability }) {
  if (status === "available") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[#E6F4EC] px-2.5 py-0.5 text-[11px] font-semibold text-[#14532D] whitespace-nowrap">
        <CheckCircle2 size={12} className="shrink-0" />
        {statusLabels.available}
      </span>
    );
  }
  if (status === "nearly-full") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[#FFF6E4] px-2.5 py-0.5 text-[11px] font-semibold text-[#9A6310] whitespace-nowrap">
        <AlertTriangle size={12} className="shrink-0" />
        {statusLabels["nearly-full"]}
      </span>
    );
  }
  if (status === "full") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[#FFF0EE] px-2.5 py-0.5 text-[11px] font-semibold text-[#B43D38] whitespace-nowrap">
        <CircleX size={12} className="shrink-0" />
        {statusLabels.full}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[#EFF2EF] px-2.5 py-0.5 text-[11px] font-semibold text-[#606E66] whitespace-nowrap">
      <CircleHelp size={12} className="shrink-0" />
      {statusLabels.unknown}
    </span>
  );
}

function LocatorContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const searchInputRef = useRef<HTMLInputElement>(null);

  const initialCategory = searchParams.get("category") as CategorySlug | null;
  const [category, setCategory] = useState<CategorySlug | "all">(
    categories.some((item) => item.slug === initialCategory)
      ? initialCategory!
      : "all",
  );

  const [rawStations, setRawStations] = useState<StationLiveStatus[]>([]);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isStale, setIsStale] = useState(false);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"nearest" | "availability">("nearest");

  const [userLocation, setUserLocation] = useState<[number, number] | null>(
    null,
  );
  const [locationError, setLocationError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);

  const loadStations = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/dashboard/live-status", {
        cache: "no-store",
      });
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
        err instanceof Error
          ? err.message
          : "Unable to reach telemetry service";
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
        const res = await fetch("/api/dashboard/live-status", {
          cache: "no-store",
        });
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
          err instanceof Error
            ? err.message
            : "Unable to reach telemetry service";
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
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
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
      const matchesSearch = `${station.name} ${station.landmark ?? ""}`
        .toLowerCase()
        .includes(query.toLowerCase());
      return (
        matchesSearch &&
        (category === "all" ||
          station.bins.some((bin) => bin.category === category))
      );
    });

    return [...result].sort((a, b) => {
      if (sort === "availability") {
        return availableCount(b) - availableCount(a);
      }
      if (category !== "all") {
        const aBin = a.bins.find((bin) => bin.category === category);
        const bBin = b.bins.find((bin) => bin.category === category);
        if (aBin && bBin && statusRank[aBin.status] !== statusRank[bBin.status]) {
          return statusRank[aBin.status] - statusRank[bBin.status];
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
    category === "all"
      ? availableCount(station) > 0
      : station.bins.find((bin) => bin.category === category)?.status ===
        "available",
  );

  const changeCategory = (value: CategorySlug | "all") => {
    setCategory(value);
    if (value === "all") {
      router.replace("/find-bin");
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
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setLocationError("Geolocation is not supported by your browser.");
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
            ? "Location permission denied. Distances remain unavailable."
            : "Unable to determine your current location.",
        );
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  return (
    <main className="w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 pt-3 pb-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-[calc(100vh-76px)] items-start">
        {/* Left 50% Column: Controls + Scrollable Station List */}
        <section
          aria-label="Station finder controls and list"
          className="flex flex-col min-w-0 lg:h-[calc(100vh-108px)] lg:min-h-[580px]"
        >
          {/* Top Controls Inside Left Column */}
          <div className="shrink-0 space-y-3.5 pb-4">
            {/* Live status pill */}
            <div className="flex items-center justify-between gap-2">
              <span
                className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider ${
                  isStale
                    ? "bg-[#FFF6E4] text-[#9A6310] border border-[#FDE8BF]"
                    : "bg-[#E9F3ED] text-[#14532D] border border-[#D4E6DA]"
                }`}
              >
                <span
                  className={`h-2 w-2 rounded-full ${
                    isStale
                      ? "bg-[#C48419]"
                      : "bg-[#16A34A] animate-pulse"
                  }`}
                />
                {isStale && fetchedAt
                  ? `OFFLINE • LAST UPDATED ${fetchedAt}`
                  : fetchedAt
                    ? `LIVE CAMPUS TELEMETRY • UPDATED ${fetchedAt}`
                    : "LIVE CAMPUS TELEMETRY • SYNCING"}
              </span>

              <button
                type="button"
                onClick={loadStations}
                disabled={loading}
                aria-label="Refresh live telemetry"
                className="inline-flex items-center gap-1.5 rounded-full border border-[#DCE5DC] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#4B5B52] hover:border-[#A8C4B2] hover:text-[#14532D] disabled:opacity-50 transition-colors"
              >
                <RefreshCw
                  size={12}
                  className={loading ? "animate-spin" : ""}
                />
                <span className="hidden sm:inline">Refresh</span>
              </button>
            </div>

            {/* Heading & subtitle */}
            <div className="space-y-1">
              <h1 className="font-display text-[28px] sm:text-[32px] font-extrabold tracking-tight text-[#1A2620] leading-[1.12]">
                Find the right bin nearby.
              </h1>
              <p className="text-sm text-[#5E6D64] leading-relaxed">
                Choose what you&apos;re disposing of, then compare suitability
                and availability.
              </p>
            </div>

            {/* Compact subtle callout box */}
            <div
              className={`rounded-xl border px-3.5 py-2.5 flex items-center gap-2.5 text-xs leading-snug ${
                locationError
                  ? "bg-[#FFF6E4] border-[#FDE8BF] text-[#8F5B10]"
                  : "bg-[#EDF4EF] border-[#DCE8E0] text-[#4C6156]"
              }`}
            >
              <Info
                size={15}
                className={`shrink-0 ${
                  locationError ? "text-[#C48419]" : "text-[#2E8B7A]"
                }`}
              />
              <span>
                {locationError
                  ? locationError
                  : userLocation
                    ? "Showing walking distances from your current GPS location."
                    : "Enable Near Me to calculate walking distances from your location."}
              </span>
            </div>

            {/* Search input + Near Me button side-by-side */}
            <div className="flex items-center gap-2.5">
              <label className="flex-1 min-w-0 h-11 px-3.5 bg-white border border-[#DCE5DC] rounded-xl flex items-center gap-2.5 focus-within:border-[#14532D] focus-within:ring-2 focus-within:ring-[#14532D]/10 transition">
                <Search size={17} className="text-[#7D8C83] shrink-0" />
                <input
                  ref={searchInputRef}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search a building or station name..."
                  className="w-full min-w-0 bg-transparent text-sm text-[#1F2A24] placeholder:text-[#8A9890] focus:outline-none"
                />
                {query ? (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    aria-label="Clear search"
                    className="rounded-md p-0.5 text-[#7D8C83] hover:text-[#1F2A24]"
                  >
                    <X size={14} />
                  </button>
                ) : (
                  <kbd className="hidden sm:inline-flex items-center rounded-md bg-[#EFF2EF] px-1.5 py-0.5 text-[10px] font-semibold text-[#7A8880] shrink-0">
                    ⌘K
                  </kbd>
                )}
              </label>

              <button
                type="button"
                onClick={toggleNearMe}
                disabled={locating}
                className={`shrink-0 h-11 px-4 rounded-xl border text-xs font-semibold inline-flex items-center justify-center gap-2 transition-colors whitespace-nowrap disabled:opacity-60 ${
                  userLocation
                    ? "bg-[#14532D] border-[#14532D] text-white hover:bg-[#0F3F22]"
                    : "bg-white border-[#C8D8CE] text-[#14532D] hover:bg-[#F2F7F3]"
                }`}
              >
                {locating ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <Crosshair size={15} />
                )}
                <span>{userLocation ? "Near Me On" : "Near Me"}</span>
              </button>
            </div>

            {/* Horizontal category filter pills */}
            <div
              className="flex flex-wrap items-center gap-2"
              role="group"
              aria-label="Waste category filters"
            >
              <button
                type="button"
                onClick={() => changeCategory("all")}
                className={`inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full border text-xs font-semibold transition-colors whitespace-nowrap ${
                  category === "all"
                    ? "bg-[#14532D] border-[#14532D] text-white shadow-xs"
                    : "bg-white border-[#DCE5DC] text-[#4E5E55] hover:border-[#A7C4B2] hover:text-[#14532D]"
                }`}
              >
                <ListFilter size={13} />
                <span>All waste</span>
              </button>

              {categories.map((item) => {
                const isActive = category === item.slug;
                return (
                  <button
                    type="button"
                    key={item.slug}
                    onClick={() => changeCategory(item.slug)}
                    className={`inline-flex items-center gap-2 h-9 px-3.5 rounded-full border text-xs font-semibold transition-colors whitespace-nowrap ${
                      isActive
                        ? "bg-[#14532D] border-[#14532D] text-white shadow-xs"
                        : "bg-white border-[#DCE5DC] text-[#4E5E55] hover:border-[#A7C4B2] hover:text-[#14532D]"
                    }`}
                  >
                    <span
                      className={`h-2 w-2 rounded-full shrink-0 ${
                        isActive ? "ring-2 ring-white/50" : ""
                      }`}
                      style={{ backgroundColor: item.color }}
                    />
                    <span>{item.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Station List Panel (Header Bar + Scrollable Cards) */}
          <div className="flex-1 min-h-0 flex flex-col rounded-2xl bg-[#F2F5F1] border border-[#E1E8E1] overflow-hidden">
            {/* Station list header bar */}
            <div className="shrink-0 px-4 py-3 bg-white border-b border-[#E7EDE7] flex items-center justify-between gap-3">
              <div className="min-w-0">
                <strong className="block text-sm font-bold text-[#1A2620] leading-tight">
                  {loading && stations.length === 0
                    ? "Loading stations…"
                    : `${filtered.length} ${
                        filtered.length === 1 ? "station" : "stations"
                      }`}
                </strong>
                <span className="block text-[11px] text-[#65736A] mt-0.5">
                  {isStale && fetchedAt
                    ? `Offline · Last updated ${fetchedAt}`
                    : "Live campus telemetry"}
                </span>
              </div>

              <label className="relative inline-flex items-center gap-1.5 rounded-lg border border-[#E1E8E1] bg-[#F7F9F7] px-2.5 py-1.5 text-xs font-semibold text-[#2E3C34] hover:border-[#C2D4C8] transition-colors">
                <ArrowDownUp size={13} className="text-[#65736A] shrink-0" />
                <select
                  aria-label="Sort stations"
                  value={sort}
                  onChange={(event) =>
                    setSort(event.target.value as "nearest" | "availability")
                  }
                  className="appearance-none bg-transparent pr-4 text-xs font-semibold text-[#202A25] focus:outline-none cursor-pointer"
                >
                  <option value="nearest">
                    {userLocation ? "Nearest first" : "Default order"}
                  </option>
                  <option value="availability">Best availability</option>
                </select>
                <ChevronDown
                  size={13}
                  className="pointer-events-none absolute right-2 text-[#65736A]"
                />
              </label>
            </div>

            {isStale && errorMsg && (
              <div className="shrink-0 mx-3 mt-3 px-3 py-2 rounded-xl bg-[#FFF6E4] border border-[#FDE8BF] text-xs text-[#9A6310] flex items-center justify-between gap-2">
                <span>Offline: showing cached telemetry from {fetchedAt}</span>
                <button
                  type="button"
                  onClick={loadStations}
                  className="font-bold underline shrink-0"
                >
                  Retry
                </button>
              </div>
            )}

            {/* Scrollable Station Cards Container */}
            <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3">
              {errorMsg && rawStations.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center py-12 px-4 rounded-xl bg-white border border-[#E1E8E1]">
                  <AlertCircle size={28} className="text-[#C84F49]" />
                  <h2 className="mt-3 font-display text-base font-bold text-[#1A2620]">
                    Telemetry service unavailable
                  </h2>
                  <p className="mt-1 text-xs text-[#65736A] max-w-xs">
                    {errorMsg}
                  </p>
                  <button
                    type="button"
                    onClick={loadStations}
                    className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-[#14532D] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0F3F22] transition-colors"
                  >
                    <RefreshCw size={13} />
                    Retry connection
                  </button>
                </div>
              ) : loading && stations.length === 0 ? (
                <div className="space-y-3">
                  {[1, 2].map((idx) => (
                    <div
                      key={idx}
                      className="rounded-xl bg-white border border-[#E1E8E1] p-4 space-y-3 animate-pulse"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-xl bg-[#EAF3ED]" />
                          <div className="space-y-1.5">
                            <div className="h-4 w-32 rounded bg-[#D7E3DA]" />
                            <div className="h-3 w-24 rounded bg-[#E6ECE6]" />
                          </div>
                        </div>
                        <div className="h-5 w-16 rounded-full bg-[#EAF3ED]" />
                      </div>
                      <div className="h-3 w-44 rounded bg-[#E6ECE6]" />
                      <div className="space-y-2 pt-2 border-t border-[#F0F4F0]">
                        <div className="h-6 w-full rounded bg-[#F5F8F5]" />
                        <div className="h-6 w-full rounded bg-[#F5F8F5]" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  {filtered.map((station) => {
                    const isSelected = selected?.id === station.id;
                    const isRecommended = recommendation?.id === station.id;
                    const rows = getStationCategoryRows(station, category);
                    const uniqueCategoryCount = new Set(
                      station.bins.map((b) => b.category),
                    ).size;

                    return (
                      <article
                        key={station.id}
                        onClick={() => setSelectedId(station.id)}
                        className={`rounded-xl bg-white p-4 border cursor-pointer transition-all ${
                          isSelected
                            ? "border-[#14532D]/45 ring-2 ring-[#14532D]/12 shadow-sm"
                            : "border-[#E1E8E1] hover:border-[#9EC2AC] hover:shadow-xs"
                        }`}
                      >
                        {/* Card Header */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 min-w-0">
                            <span
                              className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                                isSelected
                                  ? "bg-[#14532D] text-white"
                                  : "bg-[#EAF3ED] text-[#14532D]"
                              }`}
                            >
                              <MapPin size={17} />
                            </span>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <h2 className="font-display text-base font-bold text-[#1A2620] leading-snug truncate">
                                  {station.name}
                                </h2>
                                {isRecommended && (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-[#E6F4EC] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#14532D]">
                                    <Check size={11} />
                                    Recommended
                                  </span>
                                )}
                              </div>
                              {station.landmark && (
                                <p className="text-xs text-[#65736A] mt-0.5 truncate">
                                  {station.landmark}
                                </p>
                              )}
                            </div>
                          </div>

                          {!station.hasValidCoordinates ? (
                            <span className="shrink-0 rounded-full bg-[#FFF6E4] px-2.5 py-1 text-[11px] font-semibold text-[#9A6310]">
                              Location not calibrated
                            </span>
                          ) : station.distance !== undefined ? (
                            <span className="shrink-0 rounded-full bg-[#EAF3ED] px-2.5 py-1 text-xs font-bold text-[#14532D]">
                              {station.distance} m
                            </span>
                          ) : null}
                        </div>

                        {/* Availability Summary */}
                        <div className="mt-3.5 mb-2.5 flex items-center justify-between gap-2 text-xs">
                          <strong className="font-bold text-[#1F2A24]">
                            {availableCount(station)} of {station.bins.length}{" "}
                            bins available
                          </strong>
                          <span className="text-[#65736A]">
                            {station.walkTime !== undefined
                              ? `${station.walkTime} min walk · `
                              : ""}
                            {uniqueCategoryCount}{" "}
                            {uniqueCategoryCount === 1
                              ? "category"
                              : "categories"}
                          </span>
                        </div>

                        {/* Per-Category Status Rows */}
                        <div className="divide-y divide-[#F1F4F1] rounded-xl bg-[#F8FAF8] border border-[#ECF1EC] px-3 py-1">
                          {rows.map((row) => (
                            <div
                              key={row.key}
                              className="py-1.5 flex items-center justify-between gap-2"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span
                                  className="h-2 w-2 rounded-full shrink-0"
                                  style={{ backgroundColor: row.color }}
                                />
                                <span className="text-xs font-medium text-[#36453D] truncate">
                                  {row.label}
                                </span>
                                {row.meta && (
                                  <span className="text-[11px] text-[#7D8C83] shrink-0">
                                    {row.meta}
                                  </span>
                                )}
                              </div>
                              <BinAvailabilityBadge status={row.status} />
                            </div>
                          ))}
                        </div>

                        {/* Bottom Action Buttons */}
                        <div className="mt-3.5 pt-3 border-t border-[#EDF1ED] flex flex-wrap items-center gap-2">
                          <Link
                            href={`/stations/${station.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center justify-center gap-1.5 rounded-full bg-[#EAF3ED] hover:bg-[#DCECE1] text-[#14532D] px-4 py-2 text-xs font-bold transition-colors"
                          >
                            View details
                            <ArrowRight size={13} />
                          </Link>

                          {station.hasValidCoordinates &&
                          station.coordinates ? (
                            <a
                              href={`https://www.openstreetmap.org/directions?to=${station.coordinates[0]},${station.coordinates[1]}`}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center justify-center gap-1.5 rounded-full border border-[#DCE5DC] bg-white hover:bg-[#F5F8F5] text-[#2F3F36] px-4 py-2 text-xs font-semibold transition-colors"
                            >
                              <Navigation size={13} />
                              Directions
                            </a>
                          ) : (
                            <span
                              className="inline-flex items-center gap-1.5 rounded-full border border-[#E6ECE6] bg-[#F8FAF8] px-3.5 py-2 text-xs font-semibold text-[#8A9890] cursor-not-allowed"
                              title="Coordinates unavailable"
                            >
                              <Navigation size={13} />
                              Directions unavailable
                            </span>
                          )}
                        </div>
                      </article>
                    );
                  })}

                  {!loading && !filtered.length && (
                    <div className="flex flex-col items-center justify-center text-center py-12 px-4 rounded-xl bg-white border border-[#E1E8E1]">
                      <SlidersHorizontal
                        size={26}
                        className="text-[#8FA095]"
                      />
                      <h2 className="mt-3 font-display text-base font-bold text-[#1A2620]">
                        No stations found in this area.
                      </h2>
                      <p className="mt-1 text-xs text-[#65736A]">
                        Clear your search or choose another category.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setQuery("");
                          changeCategory("all");
                        }}
                        className="mt-4 inline-flex items-center justify-center rounded-full bg-[#EAF3ED] px-4 py-2 text-xs font-bold text-[#14532D] hover:bg-[#DCECE1] transition-colors"
                      >
                        Clear filters
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </section>

        {/* Right 50% Column: Full-Height Sticky Interactive Map */}
        <section
          aria-label="Interactive campus bin map"
          className="relative flex flex-col h-[520px] lg:h-[calc(100vh-108px)] lg:sticky lg:top-[92px] rounded-2xl overflow-hidden border border-black/5 shadow-sm bg-[#E5EAE5]"
        >
          <DynamicStationMap
            stations={filtered.length ? filtered : stations}
            selected={selected}
            category={category}
            onSelect={(st) => setSelectedId(st.id)}
            userLocation={userLocation}
          />

          {/* Top-left Live station telemetry pill positioned alongside Leaflet +/- zoom controls */}
          <div className="pointer-events-none absolute top-3 left-14 z-[500] inline-flex items-center gap-2 rounded-full bg-white/95 backdrop-blur-md border border-black/10 px-3 py-1.5 text-xs font-semibold text-[#2E3F35] shadow-sm">
            <span
              className={`h-2 w-2 rounded-full ${
                isStale ? "bg-[#C48419]" : "bg-[#16A34A] animate-pulse"
              }`}
            />
            <span>
              {isStale && fetchedAt
                ? `Offline · Last updated ${fetchedAt}`
                : "Live station telemetry"}
            </span>
          </div>

          {/* Floating white bottom card showing selected station */}
          {selected && (
            <div className="absolute bottom-4 left-4 right-4 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 sm:w-[min(400px,calc(100%-32px))] z-[500] flex items-center gap-3 rounded-2xl bg-white/96 backdrop-blur-md border border-black/8 px-4 py-3 shadow-lg">
              <span className="h-10 w-10 rounded-xl bg-[#14532D] text-white flex items-center justify-center shrink-0 shadow-xs">
                <MapPin size={18} />
              </span>
              <div className="min-w-0 flex-1">
                <strong className="block text-sm font-bold text-[#1A2620] truncate">
                  {selected.name}
                </strong>
                <small className="block text-xs text-[#5E6D64] mt-0.5 truncate">
                  {!selected.hasValidCoordinates
                    ? "Location not calibrated"
                    : selected.distance !== undefined
                      ? `${availableCount(selected)} of ${selected.bins.length} bins available · ${selected.distance} m away`
                      : `${availableCount(selected)} of ${selected.bins.length} bins available`}
                </small>
              </div>
              <Link
                href={`/stations/${selected.id}`}
                className="shrink-0 inline-flex items-center gap-1 rounded-xl bg-[#EAF3ED] hover:bg-[#DCECE1] text-[#14532D] px-3 py-2 text-xs font-bold transition-colors"
              >
                Details
                <ArrowRight size={14} />
              </Link>
            </div>
          )}
        </section>
      </div>
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
