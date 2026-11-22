"use client";

import React, { useState } from "react";
import { createPortal } from "react-dom";
import { StationLiveStatus, WasteCategory } from "@/components/types";
import { OperationsCard } from "@/components/ui/operations-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { emptyStationBins } from "@/lib/empty-bins";
import {
  COMPARTMENT_META,
  SpringFillBar,
  SpringPercentageText,
} from "@/components/ui/spring-fill-bar";
import {
  AlertOctagon,
  CheckCircle2,
  Trash2,
  Clock,
  Info,
  Wrench,
  Sparkles,
} from "lucide-react";

interface PriorityQueueProps {
  stations: StationLiveStatus[];
  onRefresh?: () => void;
}

interface UrgentItem {
  station_id: string;
  station_name: string;
  category: WasteCategory;
  fillPct: number;
  updatedAt: string | null;
}

export function PriorityQueue({ stations, onRefresh }: PriorityQueueProps) {
  const [selectedEmptyItem, setSelectedEmptyItem] = useState<UrgentItem | null>(
    null,
  );
  const [emptyNotes, setEmptyNotes] = useState("");
  const [isEmptying, setIsEmptying] = useState(false);
  const [emptyError, setEmptyError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleConfirmEmpty = async () => {
    if (!selectedEmptyItem || isEmptying) return;
    setIsEmptying(true);
    setEmptyError(null);

    try {
      const result = await emptyStationBins({
        stationId: selectedEmptyItem.station_id,
        compartment: selectedEmptyItem.category,
        notes: emptyNotes,
      });

      setSuccessMsg(
        `Emptied ${COMPARTMENT_META[selectedEmptyItem.category].label} compartment at ${selectedEmptyItem.station_name} at ${result.timestamp}.`,
      );
      setSelectedEmptyItem(null);
      setEmptyNotes("");
      onRefresh?.();
    } catch (err) {
      setEmptyError(
        err instanceof Error ? err.message : "Failed to empty bin.",
      );
    } finally {
      setIsEmptying(false);
    }
  };

  // Derive individual compartment items with critical fill >= 80%
  const urgentItems: UrgentItem[] = [];
  const categories: WasteCategory[] = ["plastic", "paper", "metal", "general"];

  stations.forEach((st) => {
    categories.forEach((cat) => {
      const fill = st.fill_levels[cat];
      const hasErr = Boolean(st.sensor_error_categories?.includes(cat));
      if (!hasErr && fill !== null && fill !== undefined && fill >= 80) {
        urgentItems.push({
          station_id: st.station_id,
          station_name: st.name,
          category: cat,
          fillPct: fill,
          updatedAt: st.updated_at,
        });
      }
    });
  });

  // Sort by highest fill percentage descending
  urgentItems.sort((a, b) => b.fillPct - a.fillPct);

  return (
    <div className="space-y-5">
      {successMsg && (
        <div
          role="status"
          className="rounded-2xl bg-[#E8F5EC] border border-[#BCE0C7] px-4 py-3 text-xs font-semibold text-[#14532D] flex items-center justify-between gap-2"
        >
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-[#16A34A]" />
            {successMsg}
          </span>
          <button
            type="button"
            onClick={() => setSuccessMsg(null)}
            className="text-[#14532D]/70 hover:text-[#14532D]"
          >
            ✕
          </button>
        </div>
      )}

      {/* Priority Summary Banner */}
      <div className="bg-white rounded-2xl border border-[#E5EAE4] p-5 shadow-[0_1px_2px_rgba(20,83,45,0.03)]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#FFF0EE] text-[#C84F49] border border-[#FADAD7] flex items-center justify-center">
              <AlertOctagon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#14231B] font-jakarta">
                Collection Priority Queue
              </h2>
              <p className="text-xs text-[#65736A]">
                Sorted by fill percentage descending — immediate servicing
                required (≥80%)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-3 py-1.5 rounded-full bg-[#FFF0EE] text-[#C84F49] border border-[#FADAD7] font-mono">
              {urgentItems.length} Critical{" "}
              {urgentItems.length === 1 ? "Bin" : "Bins"} (≥80%)
            </span>
          </div>
        </div>
      </div>

      {/* Critical Queue List */}
      {urgentItems.length === 0 ? (
        <OperationsCard>
          <div className="p-8 text-center space-y-2">
            <div className="w-12 h-12 rounded-full bg-[#E9F3ED] text-[#14532D] flex items-center justify-center mx-auto">
              <Sparkles className="w-6 h-6" />
            </div>
            <h4 className="font-bold text-sm text-[#14231B] font-jakarta">
              No Urgent Bins
            </h4>
            <p className="text-xs text-[#65736A] max-w-sm mx-auto">
              All monitored campus bins are currently operating below the
              critical 80% threshold.
            </p>
          </div>
        </OperationsCard>
      ) : (
        <div className="space-y-3">
          {urgentItems.map((item, idx) => (
            <div
              key={`${item.station_id}-${item.category}`}
              className="bg-white rounded-2xl border border-[#FADAD7] p-5 shadow-2xs hover:shadow-xs transition-shadow flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              <div className="space-y-2 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-[#FFF0EE] text-[#C84F49] font-mono font-bold text-xs flex items-center justify-center">
                    #{idx + 1}
                  </span>
                  <h4 className="font-bold text-sm text-[#14231B] font-jakarta">
                    {item.station_name}
                  </h4>
                  <span className="font-mono text-xs bg-[#EFF2EF] px-2 py-0.5 rounded-md text-[#65736A]">
                    {item.station_id}
                  </span>
                  <StatusBadge status="critical" label="Critical (≥80%)" />
                </div>

                <div className="w-full max-w-md space-y-1.5 pt-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="inline-flex items-center gap-1.5 font-semibold text-[#1A2620]">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{
                          backgroundColor:
                            COMPARTMENT_META[item.category].dotColor,
                        }}
                      />
                      {COMPARTMENT_META[item.category].label}
                    </span>
                    <SpringPercentageText
                      value={item.fillPct}
                      className="font-mono font-bold text-xs text-[#B93832]"
                    />
                  </div>
                  <SpringFillBar fillPct={item.fillPct} />
                </div>

                <div className="flex items-center gap-3 text-[11px] text-[#65736A] pt-1">
                  <span className="flex items-center gap-1 font-mono">
                    <Clock className="w-3 h-3 text-[#65736A]" />
                    Telemetry reading:{" "}
                    {item.updatedAt
                      ? new Date(item.updatedAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })
                      : "No reading"}
                  </span>
                </div>
              </div>

              {/* Action Button */}
              <div className="shrink-0 flex items-center gap-2">
                <Button
                  variant="danger"
                  size="md"
                  onClick={() => {
                    setEmptyError(null);
                    setSelectedEmptyItem(item);
                  }}
                >
                  <Trash2 className="w-4 h-4" />
                  Record Emptying
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Sensor Error Section (Separated from Critical Fill) */}
      <OperationsCard
        title={
          <div className="flex items-center gap-2">
            <Wrench className="w-4 h-4 text-[#9A3412]" />
            <span>Sensor Condition &amp; Diagnostic Notices</span>
          </div>
        }
        subtitle="Hardware alerts: Bins flagged with SENSOR_ERROR or offline readings require inspection"
      >
        <div className="p-4 rounded-xl bg-[#F8F9F6] border border-[#E5EAE4] space-y-2 text-xs text-[#65736A]">
          <div className="flex items-start gap-2">
            <Info className="w-4 h-4 text-[#14532D] shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              <strong>Sensor Offline / Error vs. Fill Percentage:</strong> When
              a ToF sensor reports <code>null</code> or{" "}
              <code>operational_status = &apos;SENSOR_ERROR&apos;</code>, it is
              explicitly displayed as <strong>Sensor Offline / N/A</strong>{" "}
              rather than 0% or 100% full to prevent false assumptions.
            </p>
          </div>
        </div>
      </OperationsCard>

      {/* Empty Bin Modal Dialog */}
      {selectedEmptyItem &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 sm:p-6"
            role="dialog"
            aria-modal="true"
            onClick={() => {
              if (!isEmptying) {
                setEmptyError(null);
                setSelectedEmptyItem(null);
              }
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="flex max-h-[90vh] max-w-md w-full flex-col overflow-hidden rounded-2xl bg-white border border-[#E5EAE4] shadow-2xl"
            >
              <div className="shrink-0 flex items-center justify-between border-b border-[#E5EAE4] px-6 py-4">
                <div className="flex items-center gap-2">
                  <Trash2 className="w-5 h-5 text-[#C84F49]" />
                  <h3 className="font-bold text-sm text-[#14231B] font-jakarta">
                    Confirm Bin Emptying
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedEmptyItem(null)}
                  aria-label="Close modal"
                  className="text-xs text-[#65736A] hover:text-[#202A25]"
                >
                  ✕
                </button>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-4">
                <div className="p-3.5 rounded-xl bg-[#F8F9F6] border border-[#E5EAE4] space-y-1.5 text-xs text-[#202A25]">
                  <div className="flex justify-between">
                    <span className="text-[#65736A]">Target Station:</span>
                    <span className="font-bold">
                      {selectedEmptyItem.station_name}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#65736A]">Compartment:</span>
                    <span className="font-bold capitalize">
                      {selectedEmptyItem.category}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#65736A]">Fill Before Emptying:</span>
                    <span className="font-mono font-bold text-[#C84F49]">
                      {selectedEmptyItem.fillPct}%
                    </span>
                  </div>
                </div>

                {emptyError && (
                  <div className="p-3 rounded-xl bg-[#FFF0EE] border border-[#FADAD7] text-xs text-[#C84F49]">
                    {emptyError}
                  </div>
                )}

                {/* Optional Notes */}
                <div>
                  <label className="block text-xs font-semibold text-[#202A25] mb-1">
                    Maintenance Notes (Optional)
                  </label>
                  <textarea
                    value={emptyNotes}
                    onChange={(e) => setEmptyNotes(e.target.value)}
                    placeholder="e.g., Replaced liner, cleaned ToF sensor lens"
                    rows={2}
                    disabled={isEmptying}
                    className="w-full px-3 py-2 text-xs border border-[#DCE5DC] rounded-xl bg-white text-[#202A25] focus:outline-none focus:ring-2 focus:ring-[#14532D]/15 focus:border-[#14532D] disabled:bg-[#F7F8F4] disabled:cursor-not-allowed"
                  />
                </div>
              </div>

              {/* Modal Actions */}
              <div className="shrink-0 flex justify-end gap-2 border-t border-[#E5EAE4] bg-white px-6 py-4">
                <Button
                  variant="secondary"
                  size="md"
                  disabled={isEmptying}
                  onClick={() => {
                    setEmptyError(null);
                    setSelectedEmptyItem(null);
                  }}
                >
                  Close
                </Button>
                <Button
                  variant="danger"
                  size="md"
                  disabled={isEmptying}
                  onClick={handleConfirmEmpty}
                >
                  {isEmptying ? "Emptying..." : "Confirm Emptying Bins"}
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
