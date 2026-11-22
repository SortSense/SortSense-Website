"use client";

import React, { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { StationLiveStatus, WasteCategory } from "@/components/types";
import { OperationsCard } from "@/components/ui/operations-card";
import {
  StatusBadge,
  resolveStationOperationalStatus,
} from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
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
import {
  AlertCircle,
  CheckCircle2,
  MapPin,
  RefreshCw,
  QrCode,
  Radio,
  Trash2,
} from "lucide-react";

interface StationInspectorProps {
  station: StationLiveStatus | null;
  onRefresh: () => void;
}

export function StationInspector({ station, onRefresh }: StationInspectorProps) {
  const [showProvisionModal, setShowProvisionModal] = useState(false);

  // Provisioning form state
  const [name, setName] = useState(station?.name || "");
  const [lat, setLat] = useState(station?.latitude?.toString() || "");
  const [lng, setLng] = useState(station?.longitude?.toString() || "");
  const [isProvisioning, setIsProvisioning] = useState(false);
  const [provisionError, setProvisionError] = useState<string | null>(null);

  // Unlocked emptying state
  const [emptyNotes, setEmptyNotes] = useState("");
  const [emptyingTarget, setEmptyingTarget] =
    useState<EmptyCompartmentTarget | null>(null);
  const [emptyError, setEmptyError] = useState<string | null>(null);
  const [emptySuccess, setEmptySuccess] = useState<string | null>(null);

  if (!station) {
    return (
      <OperationsCard>
        <div className="p-8 text-center text-[#65736A] space-y-2">
          <Radio className="w-8 h-8 mx-auto text-[#14532D]/40" />
          <h4 className="font-bold text-sm text-[#14231B] font-jakarta">
            No Station Selected
          </h4>
          <p className="text-xs max-w-xs mx-auto">
            Select a station from the fleet overview to inspect compartment
            telemetry and maintenance controls.
          </p>
        </div>
      </OperationsCard>
    );
  }

  const handleEmpty = async (target: EmptyCompartmentTarget) => {
    if (emptyingTarget) return;
    setEmptyingTarget(target);
    setEmptyError(null);
    setEmptySuccess(null);

    try {
      const result = await emptyStationBins({
        stationId: station.station_id,
        compartment: target,
        notes: emptyNotes,
      });
      const label =
        target === "all"
          ? "all compartments"
          : `${COMPARTMENT_META[target].label} compartment`;
      setEmptySuccess(
        `Emptied ${label} at ${station.name} at ${result.timestamp}.`,
      );
      setEmptyNotes("");
      onRefresh();
    } catch (err) {
      setEmptyError(
        err instanceof Error ? err.message : "Failed to empty bin.",
      );
    } finally {
      setEmptyingTarget(null);
    }
  };

  const handleProvision = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProvisioning(true);
    setProvisionError(null);

    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const res = await fetch("/api/bins/provision", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token
            ? { Authorization: `Bearer ${session.access_token}` }
            : {}),
        },
        body: JSON.stringify({
          station_id: station.station_id,
          name,
          latitude: parseFloat(lat),
          longitude: parseFloat(lng),
        }),
      });

      if (res.ok) {
        setShowProvisionModal(false);
        onRefresh();
      } else {
        const errData = await res.json().catch(() => ({}));
        setProvisionError(
          errData.detail || `Failed to save coordinates (HTTP ${res.status})`,
        );
      }
    } catch {
      setProvisionError("Network error while saving station coordinates.");
    } finally {
      setIsProvisioning(false);
    }
  };

  const categories: WasteCategory[] = ["plastic", "paper", "metal", "general"];
  const resolvedStatus = resolveStationOperationalStatus(station);

  return (
    <OperationsCard
      title={
        <div className="flex items-center gap-2">
          <span className="font-bold text-sm text-[#14231B] font-jakarta">
            {station.name}
          </span>
          <span className="font-mono text-xs px-2 py-0.5 rounded bg-[#EFF2EF] text-[#65736A] font-medium">
            {station.station_id}
          </span>
        </div>
      }
      subtitle={
        <div className="flex flex-wrap items-center gap-2 text-xs text-[#65736A] mt-1">
          {station.latitude && station.longitude ? (
            <span className="flex items-center gap-1">
              <MapPin className="w-3 h-3 text-[#14532D]" />
              {station.latitude.toFixed(4)}, {station.longitude.toFixed(4)}
            </span>
          ) : (
            <span className="italic">Coordinates Pending Provisioning</span>
          )}
          <span>•</span>
          <span>
            {station.updated_at
              ? `Last bin reading: ${new Date(station.updated_at).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}${station.is_stale ? " (Stale)" : ""}`
              : "No reading"}
          </span>
        </div>
      }
      action={
        <div className="flex items-center gap-2">
          <StatusBadge
            status={resolvedStatus.status}
            label={resolvedStatus.label}
          />
          <button
            type="button"
            onClick={() => {
              setName(station.name);
              setLat(station.latitude?.toString() || "");
              setLng(station.longitude?.toString() || "");
              setShowProvisionModal(true);
            }}
            title="GPS Provisioning"
            className="p-1.5 rounded-lg border border-[#E1E8E1] hover:bg-[#E9F3ED] text-[#14532D] transition-colors"
          >
            <QrCode className="w-4 h-4" />
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        {emptySuccess && (
          <div className="p-3 rounded-xl bg-[#E8F5EC] border border-[#BCE0C7] text-xs font-medium text-[#14532D] flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-[#16A34A]" />
            <span>{emptySuccess}</span>
          </div>
        )}
        {emptyError && (
          <div className="p-3 rounded-xl bg-[#FFF0EE] border border-[#FADAD7] text-xs font-medium text-[#C84F49] flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{emptyError}</span>
          </div>
        )}

        {/* 4 Compartment Fill Gauges */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs font-bold text-[#65736A] uppercase tracking-wider font-jakarta">
            <span>Compartment Fill Gauges</span>
            <span>
              Max Fill:{" "}
              {station.max_fill_pct !== null
                ? `${station.max_fill_pct}%`
                : "N/A"}
            </span>
          </div>

          <div className="space-y-2.5">
            {categories.map((cat) => {
              const pct = station.fill_levels[cat] ?? null;
              const hasErr = Boolean(
                station.sensor_error_categories?.includes(cat),
              );
              const threshold = getFillThresholdStyle(pct, hasErr);
              const isOffline =
                threshold.level === "offline" || threshold.level === "error";

              return (
                <div
                  key={cat}
                  className="p-3 rounded-xl border border-[#E5EAE4] bg-[#F8F9F6] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex-1 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="inline-flex items-center gap-1.5 font-semibold text-[#1A2620]">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{
                            backgroundColor: COMPARTMENT_META[cat].dotColor,
                          }}
                        />
                        {COMPARTMENT_META[cat].label}
                      </span>
                      {isOffline ? (
                        <span className="text-[10px] font-bold text-[#606E66] bg-[#EFF2EF] px-2 py-0.5 rounded-full">
                          {threshold.statusText}
                        </span>
                      ) : (
                        <SpringPercentageText
                          value={pct}
                          hasSensorError={hasErr}
                          className="font-mono font-bold text-xs text-[#1A2620]"
                        />
                      )}
                    </div>
                    <SpringFillBar
                      fillPct={pct}
                      hasSensorError={hasErr}
                      heightClassName="h-2"
                    />
                  </div>
                  <div className="shrink-0 flex items-center justify-end">
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={Boolean(emptyingTarget)}
                      onClick={() => handleEmpty(cat)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span className="text-[11px]">
                        {emptyingTarget === cat ? "Emptying…" : "Empty"}
                      </span>
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Station-Wide Empty Action */}
        <div className="pt-3 border-t border-[#E5EAE4] space-y-2.5">
          <div>
            <label className="block text-[11px] font-semibold text-[#55645C] mb-1">
              Maintenance Notes (Optional)
            </label>
            <input
              type="text"
              value={emptyNotes}
              onChange={(e) => setEmptyNotes(e.target.value)}
              disabled={Boolean(emptyingTarget)}
              placeholder="e.g., Full liner replacement & ToF calibration check"
              className="w-full px-3 py-2 text-xs border border-[#DCE5DC] rounded-xl bg-white text-[#1A2620] focus:outline-none focus:border-[#14532D] focus:ring-2 focus:ring-[#14532D]/12"
            />
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <span className="text-xs text-[#65736A]">
              Reset all 4 compartments at once:
            </span>
            <Button
              variant="primary"
              size="sm"
              disabled={Boolean(emptyingTarget)}
              onClick={() => handleEmpty("all")}
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${emptyingTarget === "all" ? "animate-spin" : ""}`}
              />
              <span>
                {emptyingTarget === "all"
                  ? "Emptying Bins..."
                  : "Confirm Emptying Bins"}
              </span>
            </Button>
          </div>
        </div>
      </div>

      {/* GPS Provisioning Modal */}
      {showProvisionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 border border-[#E1E8E1] shadow-xl">
            <div className="flex items-center justify-between border-b border-[#E1E8E1] pb-3">
              <h3 className="font-bold text-sm text-[#14231B] font-jakarta flex items-center gap-2">
                <QrCode className="w-4 h-4 text-[#14532D]" />
                Station GPS Provisioning
              </h3>
              <button
                type="button"
                onClick={() => setShowProvisionModal(false)}
                className="text-xs text-[#65736A] hover:text-[#202A25]"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-[#65736A]">
              Calibrate installation coordinates for{" "}
              <strong className="font-mono text-[#202A25]">
                {station.station_id}
              </strong>
              .
            </p>

            {provisionError && (
              <div className="p-2.5 rounded-lg bg-[#FFF0EE] border border-[#FADAD7] text-xs text-[#C84F49]">
                {provisionError}
              </div>
            )}

            <form onSubmit={handleProvision} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#202A25] mb-1">
                  Station Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-[#E1E8E1] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#14532D]/20 focus:border-[#14532D]"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#202A25] mb-1">
                    Latitude
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    value={lat}
                    onChange={(e) => setLat(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono border border-[#E1E8E1] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#14532D]/20 focus:border-[#14532D]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#202A25] mb-1">
                    Longitude
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    value={lng}
                    onChange={(e) => setLng(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono border border-[#E1E8E1] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#14532D]/20 focus:border-[#14532D]"
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#E1E8E1]">
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={() => setShowProvisionModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  disabled={isProvisioning}
                >
                  {isProvisioning ? "Saving..." : "Save Coordinates"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </OperationsCard>
  );
}
