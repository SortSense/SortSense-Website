"use client";

import React, { useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  MapPin,
  Radio,
  Trash2,
  Wifi,
  WifiOff,
  Wrench,
} from "lucide-react";
import type { StationLiveStatus, WasteCategory } from "@/components/types";
import {
  emptyStationBins,
  type EmptyCompartmentTarget,
} from "@/lib/empty-bins";
import {
  COMPARTMENT_META,
  SpringFillBar,
  SpringPercentageText,
  getFillThresholdStyle,
} from "@/components/ui/spring-fill-bar";

const COMPARTMENTS: WasteCategory[] = ["plastic", "paper", "metal", "general"];

interface StationTelemetryControlProps {
  station: StationLiveStatus | null;
  stations: StationLiveStatus[];
  showStationPills?: boolean;
  onSelectStation?: (stationId: string) => void;
  onRefresh: () => void;
  onEmptySuccess?: (message: string) => void;
}

export function StationTelemetryControl({
  station,
  stations,
  showStationPills = false,
  onSelectStation,
  onRefresh,
  onEmptySuccess,
}: StationTelemetryControlProps) {
  const [target, setTarget] = useState<EmptyCompartmentTarget>("all");
  const [notes, setNotes] = useState("");
  const [isEmptying, setIsEmptying] = useState(false);
  const [emptyError, setEmptyError] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  if (!station) {
    return (
      <section className="bg-white rounded-2xl border border-[#E5EAE4] p-8 text-center shadow-[0_1px_2px_rgba(20,83,45,0.03)]">
        <div className="w-11 h-11 rounded-2xl bg-[#EEF5F0] text-[#14532D] flex items-center justify-center mx-auto">
          <Radio className="w-5 h-5" />
        </div>
        <h2 className="mt-3 text-base font-bold text-[#14231B] font-jakarta">
          No Active Station Available
        </h2>
        <p className="mt-1 text-xs text-[#617067] max-w-sm mx-auto">
          Once campus telemetry reports an active station, compartment fill
          gauges and emptying controls will appear here.
        </p>
      </section>
    );
  }

  const handleConfirmEmpty = async () => {
    if (isEmptying) return;
    setIsEmptying(true);
    setEmptyError(null);
    setSuccessBanner(null);

    try {
      const result = await emptyStationBins({
        stationId: station.station_id,
        compartment: target,
        notes,
      });

      const targetLabel =
        target === "all"
          ? "all 4 compartments"
          : `${COMPARTMENT_META[target].label} compartment`;
      const msg = `Emptied ${targetLabel} at ${station.name} (${station.station_id}) at ${result.timestamp}.`;
      setSuccessBanner(msg);
      setNotes("");
      onEmptySuccess?.(msg);
      onRefresh();
    } catch (err) {
      setEmptyError(
        err instanceof Error ? err.message : "Failed to empty bins.",
      );
    } finally {
      setIsEmptying(false);
    }
  };

  const hasValidCoords =
    typeof station.latitude === "number" &&
    typeof station.longitude === "number" &&
    (station.latitude !== 0 || station.longitude !== 0);

  const selectedFill =
    target === "all" ? station.max_fill_pct : station.fill_levels[target];
  const isTargetCritical =
    typeof selectedFill === "number" && selectedFill >= 80;

  return (
    <section className="bg-white rounded-2xl border border-[#E5EAE4] shadow-[0_1px_3px_rgba(20,83,45,0.04)] overflow-hidden">
      {/* Card Header */}
      <div className="px-5 py-4 border-b border-[#EDF1EC] flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-jakarta text-lg font-extrabold tracking-tight text-[#14231B] truncate">
                {station.name}
              </h2>
              <span className="font-mono text-[11px] font-semibold px-2 py-0.5 rounded-md bg-[#F2F5F2] text-[#55645C] border border-[#E2E9E2]">
                {station.station_id}
              </span>
            </div>

            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#617067]">
              <span className="inline-flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-[#14532D]" />
                {station.location_name
                  ? station.location_name
                  : hasValidCoords
                    ? `${station.latitude!.toFixed(4)}, ${station.longitude!.toFixed(4)}`
                    : "Coordinates pending"}
              </span>
              <span className="text-[#D4DDD6]">•</span>
              <span className="inline-flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-[#7A8A80]" />
                {station.updated_at
                  ? `Reading ${new Date(station.updated_at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}${station.is_stale ? " (Stale)" : ""}`
                  : "Awaiting telemetry"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {station.is_online ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E9F4EC] border border-[#CBE4D3] px-3 py-1 text-xs font-semibold text-[#14532D]">
                <Wifi className="w-3.5 h-3.5" />
                Online
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F2F4F2] border border-[#DCE3DC] px-3 py-1 text-xs font-semibold text-[#5E6D64]">
                <WifiOff className="w-3.5 h-3.5" />
                {station.is_stale ? "Offline (Stale)" : "Offline"}
              </span>
            )}
          </div>
        </div>

        {/* Optional quick station tabs when "All Stations" mode has multiple stations */}
        {showStationPills && stations.length > 1 && onSelectStation && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            {stations.map((st) => {
              const active = st.station_id === station.station_id;
              return (
                <button
                  key={st.station_id}
                  type="button"
                  onClick={() => {
                    setSuccessBanner(null);
                    setEmptyError(null);
                    onSelectStation(st.station_id);
                  }}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold border transition-colors ${
                    active
                      ? "bg-[#14532D] border-[#14532D] text-white"
                      : "bg-[#F8F9F6] border-[#DCE5DC] text-[#4E5E55] hover:border-[#A7C4B2] hover:text-[#14532D]"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      st.is_online
                        ? active
                          ? "bg-[#A7F3D0]"
                          : "bg-[#16A34A]"
                        : "bg-[#9CA8A0]"
                    }`}
                  />
                  <span>{st.name}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Body: 4 Compartment Telemetry Cards + Unlocked Emptying Control */}
      <div className="p-5 space-y-5">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#5A6A61]">
              Live Compartment Telemetry
            </h3>
            <p className="text-xs text-[#738279] mt-0.5">
              Click any compartment to target it for individual emptying, or
              reset all 4 at once.
            </p>
          </div>
          <span className="hidden sm:inline-flex items-center gap-3 text-[11px] text-[#65736A]">
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[#14532D]" />
              &lt;50%
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[#D98A1C]" />
              50–79%
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[#DC4C46]" />
              ≥80%
            </span>
          </span>
        </div>

        {/* 4 Visual Compartment Cards with @react-spring/web Gauges */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {COMPARTMENTS.map((cat) => {
            const meta = COMPARTMENT_META[cat];
            const fillPct = station.fill_levels[cat] ?? null;
            const hasSensorError = Boolean(
              station.sensor_error_categories?.includes(cat),
            );
            const isOffline =
              hasSensorError ||
              fillPct === null ||
              fillPct === undefined ||
              Number.isNaN(fillPct);
            const threshold = getFillThresholdStyle(fillPct, hasSensorError);
            const isSelected = target === cat;

            return (
              <button
                key={cat}
                type="button"
                onClick={() => setTarget(isSelected ? "all" : cat)}
                className={`text-left rounded-xl border p-4 transition-all ${
                  isSelected
                    ? "bg-[#F4F9F5] border-[#14532D] ring-2 ring-[#14532D]/12 shadow-xs"
                    : "bg-[#FAFBFA] border-[#E5EAE4] hover:border-[#B6CEBE] hover:bg-white"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="h-3 w-3 rounded-full shrink-0"
                      style={{ backgroundColor: meta.dotColor }}
                    />
                    <span className="font-jakarta text-sm font-bold text-[#1A2620] truncate">
                      {meta.label}
                    </span>
                  </div>

                  {isOffline ? (
                    <span
                      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold border whitespace-nowrap"
                      style={{
                        backgroundColor: threshold.badgeBg,
                        color: threshold.badgeText,
                        borderColor: threshold.badgeBorder,
                      }}
                    >
                      {hasSensorError && <Wrench className="w-2.5 h-2.5" />}
                      {threshold.statusText}
                    </span>
                  ) : (
                    <span
                      className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold border whitespace-nowrap"
                      style={{
                        backgroundColor: threshold.badgeBg,
                        color: threshold.badgeText,
                        borderColor: threshold.badgeBorder,
                      }}
                    >
                      {threshold.statusText}
                    </span>
                  )}
                </div>

                {/* Big Readout + Animated Bar */}
                <div className="mt-3 flex items-baseline justify-between gap-2">
                  <SpringPercentageText
                    value={fillPct}
                    hasSensorError={hasSensorError}
                    className={`font-jakarta text-2xl font-extrabold tabular-nums tracking-tight ${
                      isOffline
                        ? "text-[#7A8880]"
                        : threshold.level === "critical"
                          ? "text-[#B93832]"
                          : threshold.level === "warning"
                            ? "text-[#9A6310]"
                            : "text-[#14532D]"
                    }`}
                  />
                  <span className="text-[11px] text-[#6B7A71]">
                    {isOffline
                      ? "Awaiting ToF reading"
                      : isSelected
                        ? "Targeted to empty"
                        : "Click to isolate"}
                  </span>
                </div>

                <div className="mt-2.5">
                  <SpringFillBar
                    fillPct={fillPct}
                    hasSensorError={hasSensorError}
                    heightClassName="h-2.5"
                  />
                </div>
              </button>
            );
          })}
        </div>

        {/* Unlocked Staff Emptying Control Panel */}
        <div className="rounded-2xl bg-[#F5F8F5] border border-[#DDE7DE] p-4 space-y-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-xl bg-[#14532D] text-white flex items-center justify-center shrink-0">
                <Trash2 className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-jakarta text-sm font-bold text-[#14231B]">
                  Staff Bin Emptying Control
                </h3>
                <p className="text-[11px] text-[#5D6C63]">
                  Logs a verified emptying event and resets fill level to 0% in
                  Supabase.
                </p>
              </div>
            </div>

            <span className="inline-flex items-center gap-1 rounded-full bg-[#E9F4EC] border border-[#CBE4D3] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#14532D]">
              <CheckCircle2 className="w-3 h-3" />
              Staff Action Unlocked
            </span>
          </div>

          {/* Target Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setTarget("all")}
              className={`rounded-full px-3 py-1 text-xs font-semibold border transition-colors ${
                target === "all"
                  ? "bg-[#14532D] border-[#14532D] text-white"
                  : "bg-white border-[#DCE5DC] text-[#4E5E55] hover:border-[#9EC2AC]"
              }`}
            >
              All 4 Compartments
            </button>
            {COMPARTMENTS.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setTarget(cat)}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold border transition-colors ${
                  target === cat
                    ? "bg-[#14532D] border-[#14532D] text-white"
                    : "bg-white border-[#DCE5DC] text-[#4E5E55] hover:border-[#9EC2AC]"
                }`}
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: COMPARTMENT_META[cat].dotColor }}
                />
                {COMPARTMENT_META[cat].label}
              </button>
            ))}
          </div>

          {/* Inline Confirmation / Error Feedback */}
          {successBanner && (
            <div
              role="status"
              className="rounded-xl bg-[#E8F5EC] border border-[#BCE0C7] px-3.5 py-2.5 text-xs font-medium text-[#14532D] flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4 shrink-0 text-[#16A34A]" />
              <span>{successBanner}</span>
            </div>
          )}

          {emptyError && (
            <div
              role="alert"
              className="rounded-xl bg-[#FFF0EE] border border-[#FAD6D2] px-3.5 py-2.5 text-xs font-medium text-[#B93832] flex items-center gap-2"
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{emptyError}</span>
            </div>
          )}

          {/* Maintenance Notes + Confirm Emptying Bins Button */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3">
            <div className="flex-1 min-w-0">
              <label
                htmlFor="dashboard-maintenance-notes"
                className="block text-[11px] font-semibold text-[#47574E] mb-1"
              >
                Maintenance Notes (Optional)
              </label>
              <input
                id="dashboard-maintenance-notes"
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={isEmptying}
                placeholder="e.g., Replaced liner, wiped ToF sensor lens"
                className="w-full h-10 px-3.5 rounded-xl border border-[#D8E2D9] bg-white text-xs text-[#1A2620] placeholder:text-[#8A9890] focus:outline-none focus:border-[#14532D] focus:ring-2 focus:ring-[#14532D]/12 disabled:opacity-60"
              />
            </div>

            <button
              type="button"
              disabled={isEmptying}
              onClick={handleConfirmEmpty}
              className={`shrink-0 h-10 px-5 rounded-full text-xs font-bold text-white inline-flex items-center justify-center gap-2 transition-colors shadow-xs disabled:opacity-60 whitespace-nowrap ${
                isTargetCritical
                  ? "bg-[#C84F49] hover:bg-[#B23D37]"
                  : "bg-[#14532D] hover:bg-[#0F3F22]"
              }`}
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>
                {isEmptying ? "Emptying Bins..." : "Confirm Emptying Bins"}
              </span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
