"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  MapPin,
  Search,
  WifiOff,
} from "lucide-react";
import type { StationLiveStatus, WasteCategory } from "@/components/types";

type StationFilterTab = "all" | "available" | "attention";

const COMPARTMENTS: Array<{ key: WasteCategory; label: string }> = [
  { key: "plastic", label: "Plastic" },
  { key: "paper", label: "Paper" },
  { key: "metal", label: "Metal" },
  { key: "general", label: "General" },
];

function gaugeBarClass(fill: number | null, hasError: boolean): string {
  if (hasError || fill === null) return "bg-slate-300";
  if (fill >= 80) return "bg-red-600";
  if (fill >= 50) return "bg-amber-500";
  return "bg-[#48A868]";
}

function stationNeedsAttention(st: StationLiveStatus): boolean {
  if (st.has_sensor_error) return true;
  return COMPARTMENTS.some(({ key }) => {
    const val = st.fill_levels[key];
    return val !== null && val !== undefined && val >= 80;
  });
}

function stationHasAvailableSpace(st: StationLiveStatus): boolean {
  return COMPARTMENTS.some(({ key }) => {
    const val = st.fill_levels[key];
    const hasErr = st.sensor_error_categories?.includes(key);
    return !hasErr && val !== null && val !== undefined && val < 80;
  });
}

interface LiveCampusOverviewProps {
  stations: StationLiveStatus[];
  loading: boolean;
  error: string | null;
}

export function LiveCampusOverview({
  stations,
  loading,
  error,
}: LiveCampusOverviewProps) {
  const [filterTab, setFilterTab] = useState<StationFilterTab>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredStations = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return stations.filter((st) => {
      if (filterTab === "available" && !stationHasAvailableSpace(st)) {
        return false;
      }
      if (filterTab === "attention" && !stationNeedsAttention(st)) {
        return false;
      }
      if (!q) return true;
      return (
        st.name.toLowerCase().includes(q) ||
        st.station_id.toLowerCase().includes(q) ||
        (st.location_name ?? "").toLowerCase().includes(q)
      );
    });
  }, [stations, filterTab, searchQuery]);

  return (
    <section
      id="live-stations"
      className="page-width my-12 space-y-6 scroll-mt-24"
      aria-label="Live Campus Station Status"
    >
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <span className="renew-kicker">
            <i /> Live Telemetry Feed
          </span>
          <h2 className="mt-1 text-2xl sm:text-3xl font-bold text-[#202A25] font-display">
            Campus Station Availability
          </h2>
          <p className="text-sm text-[#65736A] mt-1">
            Color thresholds: Green (&lt;50%), Amber (50–79%), Red (≥80%).
            Unavailable sensors display N/A instead of 0%.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              { id: "all", label: "All" },
              { id: "available", label: "Available" },
              { id: "attention", label: "Needs Attention" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterTab(tab.id)}
              className={`min-h-[44px] rounded-xl px-4 py-2 text-xs sm:text-sm font-semibold transition ${
                filterTab === tab.id
                  ? "bg-[#176B45] text-white shadow-xs"
                  : "border border-[#DCE5DC] bg-white text-[#202A25] hover:bg-[#E9F3ED]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="w-4 h-4 text-[#65736A] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search station or campus location..."
          aria-label="Filter stations by name or location"
          className="w-full min-h-[44px] rounded-xl border border-[#DCE5DC] bg-white pl-10 pr-4 text-sm text-[#202A25] placeholder:text-[#65736A] focus:border-[#176B45] focus:outline-none focus:ring-2 focus:ring-[#176B45]/15"
        />
      </div>

      {error && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading && stations.length === 0 ? (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {[0, 1].map((idx) => (
            <div
              key={idx}
              className="rounded-3xl border border-[#DCE5DC] bg-white p-6 space-y-5 animate-pulse"
              aria-hidden="true"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2 flex-1">
                  <div className="h-5 w-44 rounded bg-[#E1E8E1]" />
                  <div className="h-4 w-32 rounded bg-[#EFF2EF]" />
                </div>
                <div className="h-7 w-24 rounded-full bg-[#EFF2EF]" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {[0, 1, 2, 3].map((g) => (
                  <div
                    key={g}
                    className="rounded-xl bg-[#F7F8F4] p-3.5 space-y-2"
                  >
                    <div className="h-3.5 w-20 rounded bg-[#E1E8E1]" />
                    <div className="h-2.5 w-full rounded-full bg-[#E1E8E1]" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : filteredStations.length === 0 ? (
        <div className="rounded-3xl border border-[#DCE5DC] bg-white p-8 text-center text-sm text-[#65736A]">
          No stations match the selected filter.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {filteredStations.map((st) => {
            const attention = stationNeedsAttention(st);
            return (
              <article
                key={st.station_id}
                className="rounded-3xl border border-[#DCE5DC] bg-white p-5 sm:p-6 shadow-sm flex flex-col justify-between gap-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-bold text-[#202A25] font-display">
                        {st.name}
                      </h3>
                      <span className="rounded-md bg-[#EFF2EF] px-2 py-0.5 font-mono text-xs text-[#65736A]">
                        {st.station_id}
                      </span>
                    </div>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-[#65736A]">
                      <MapPin className="w-3.5 h-3.5 text-[#38A6A0] shrink-0" />
                      <span>{st.location_name || "Campus Station"}</span>
                    </p>
                  </div>

                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                      attention
                        ? "bg-[#FFF0EE] text-[#C84F49] border border-[#FADAD7]"
                        : st.connectivity_status === "ONLINE"
                          ? "bg-[#E9F3ED] text-[#176B45]"
                          : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {attention
                      ? "Needs Attention"
                      : st.connectivity_status === "ONLINE"
                        ? "Online"
                        : "Standby"}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {COMPARTMENTS.map(({ key, label }) => {
                    const fill = st.fill_levels[key];
                    const isErr = Boolean(
                      st.sensor_error_categories?.includes(key),
                    );
                    const unavailable =
                      isErr || fill === null || fill === undefined;
                    return (
                      <div
                        key={key}
                        className="rounded-2xl border border-[#EFF2EF] bg-[#F7F8F4] p-3.5 space-y-2"
                        title={
                          unavailable
                            ? "Sensor reading unavailable or offline (never assumed 0%)"
                            : `${label}: ${fill}%`
                        }
                      >
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <span className="font-semibold text-[#202A25]">
                            {label}
                          </span>
                          {unavailable ? (
                            <span className="inline-flex items-center gap-1 font-semibold text-[#65736A]">
                              <WifiOff className="w-3 h-3" />
                              Sensor Offline / N/A
                            </span>
                          ) : (
                            <span className="font-mono font-bold text-[#202A25]">
                              {fill}%
                            </span>
                          )}
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-[#E1E8E1]">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${gaugeBarClass(
                              fill ?? null,
                              isErr,
                            )}`}
                            style={{ width: `${unavailable ? 0 : fill}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#EFF2EF] pt-3">
                  <span className="text-xs text-[#65736A]">
                    {st.floors && st.floors.length > 0
                      ? `${st.floors.length} floor${st.floors.length === 1 ? "" : "s"} configured`
                      : "4 standard compartments"}
                  </span>
                  <Link
                    href={`/stations/${encodeURIComponent(st.station_id)}`}
                    className="inline-flex items-center justify-center gap-1.5 min-h-[44px] rounded-xl bg-[#176B45] px-4 py-2 text-xs font-semibold text-white hover:bg-[#125637] transition"
                  >
                    Open Station Details
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
