"use client";

import React, { useState } from "react";
import {
  Activity,
  AlertOctagon,
  CheckCircle2,
  Clock,
  Lock,
  Sparkles,
  Trash2,
  XCircle,
} from "lucide-react";
import type {
  StationLiveStatus,
  WasteCategory,
  WasteEvent,
} from "@/components/types";
import { emptyStationBins } from "@/lib/empty-bins";
import {
  COMPARTMENT_META,
  SpringFillBar,
  getFillThresholdStyle,
} from "@/components/ui/spring-fill-bar";

const COMPARTMENTS: WasteCategory[] = ["plastic", "paper", "metal", "general"];

interface QueueEntry {
  key: string;
  stationId: string;
  stationName: string;
  category: WasteCategory;
  fillPct: number | null;
  hasSensorError: boolean;
  updatedAt: string | null;
}

interface PriorityPickupWidgetProps {
  stations: StationLiveStatus[];
  onRefresh: () => void;
  onSelectStation?: (stationId: string) => void;
  onQuickEmptyToast?: (msg: string) => void;
}

export function PriorityPickupWidget({
  stations,
  onRefresh,
  onSelectStation,
  onQuickEmptyToast,
}: PriorityPickupWidgetProps) {
  const [emptyingKey, setEmptyingKey] = useState<string | null>(null);
  const [queueError, setQueueError] = useState<string | null>(null);

  const entries: QueueEntry[] = [];
  stations.forEach((st) => {
    COMPARTMENTS.forEach((cat) => {
      entries.push({
        key: `${st.station_id}-${cat}`,
        stationId: st.station_id,
        stationName: st.name,
        category: cat,
        fillPct: st.fill_levels[cat] ?? null,
        hasSensorError: Boolean(st.sensor_error_categories?.includes(cat)),
        updatedAt: st.updated_at,
      });
    });
  });

  // Pin >=80% critical compartments at top, then descending fill%, then offline/null at bottom
  entries.sort((a, b) => {
    const aOffline = a.fillPct === null || a.hasSensorError;
    const bOffline = b.fillPct === null || b.hasSensorError;
    if (aOffline !== bOffline) return aOffline ? 1 : -1;
    if (!aOffline && !bOffline) {
      return (b.fillPct as number) - (a.fillPct as number);
    }
    return a.stationName.localeCompare(b.stationName);
  });

  const criticalCount = entries.filter(
    (e) => !e.hasSensorError && e.fillPct !== null && e.fillPct >= 80,
  ).length;

  const handleQuickEmpty = async (entry: QueueEntry) => {
    if (emptyingKey) return;
    setEmptyingKey(entry.key);
    setQueueError(null);
    try {
      const result = await emptyStationBins({
        stationId: entry.stationId,
        compartment: entry.category,
        notes: "Cleared from Priority Pickup Queue",
      });
      onQuickEmptyToast?.(
        `Emptied ${COMPARTMENT_META[entry.category].label} at ${entry.stationName} at ${result.timestamp}.`,
      );
      onRefresh();
    } catch (err) {
      setQueueError(
        err instanceof Error ? err.message : "Failed to empty compartment.",
      );
    } finally {
      setEmptyingKey(null);
    }
  };

  return (
    <section className="bg-white rounded-2xl border border-[#E5EAE4] shadow-[0_1px_3px_rgba(20,83,45,0.04)] overflow-hidden">
      <div className="px-5 py-4 border-b border-[#EDF1EC] flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={`h-8 w-8 rounded-xl flex items-center justify-center shrink-0 ${
              criticalCount > 0
                ? "bg-[#FFF0EE] text-[#C84F49]"
                : "bg-[#E9F4EC] text-[#14532D]"
            }`}
          >
            {criticalCount > 0 ? (
              <AlertOctagon className="w-4 h-4" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
          </div>
          <div className="min-w-0">
            <h2 className="font-jakarta text-sm font-bold text-[#14231B] truncate">
              Priority Pickup Queue
            </h2>
            <p className="text-[11px] text-[#65736A] truncate">
              Compartments sorted by fill urgency (≥80% pinned first)
            </p>
          </div>
        </div>

        <span
          className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold border ${
            criticalCount > 0
              ? "bg-[#FFF0EE] text-[#B93832] border-[#FAD6D2]"
              : "bg-[#E9F4EC] text-[#14532D] border-[#CBE4D3]"
          }`}
        >
          {criticalCount > 0 ? `${criticalCount} Urgent` : "All Clear"}
        </span>
      </div>

      {queueError && (
        <div className="mx-4 mt-3 rounded-xl bg-[#FFF0EE] border border-[#FAD6D2] px-3 py-2 text-xs text-[#B93832]">
          {queueError}
        </div>
      )}

      <div className="p-3.5 max-h-[300px] overflow-y-auto space-y-2">
        {entries.length === 0 ? (
          <div className="py-8 text-center text-xs text-[#65736A]">
            No compartments monitored yet.
          </div>
        ) : (
          entries.map((entry) => {
            const meta = COMPARTMENT_META[entry.category];
            const threshold = getFillThresholdStyle(
              entry.fillPct,
              entry.hasSensorError,
            );
            const isCritical = threshold.level === "critical";
            const isOffline =
              threshold.level === "offline" || threshold.level === "error";
            const isBusy = emptyingKey === entry.key;

            return (
              <div
                key={entry.key}
                onClick={() => onSelectStation?.(entry.stationId)}
                className={`rounded-xl border p-3 transition-colors cursor-pointer ${
                  isCritical
                    ? "bg-[#FFF9F8] border-[#F8D0CB] hover:border-[#E9A69E]"
                    : "bg-[#FAFBFA] border-[#E8EDE7] hover:border-[#C5D8CB]"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: meta.dotColor }}
                    />
                    <span className="text-xs font-bold text-[#1A2620] truncate">
                      {entry.stationName}
                    </span>
                    <span className="text-[11px] font-semibold text-[#5E6D64] shrink-0">
                      · {meta.label}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px] font-bold border whitespace-nowrap"
                      style={{
                        backgroundColor: threshold.badgeBg,
                        color: threshold.badgeText,
                        borderColor: threshold.badgeBorder,
                      }}
                    >
                      {isOffline
                        ? threshold.statusText
                        : `${Math.round(entry.fillPct!)}%`}
                    </span>

                    <button
                      type="button"
                      disabled={Boolean(emptyingKey)}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleQuickEmpty(entry);
                      }}
                      title={`Empty ${meta.label} at ${entry.stationName}`}
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold transition-colors disabled:opacity-50 ${
                        isCritical
                          ? "bg-[#C84F49] text-white hover:bg-[#B23D37]"
                          : "bg-[#EAF3ED] text-[#14532D] hover:bg-[#DCECE1]"
                      }`}
                    >
                      <Trash2 className="w-3 h-3" />
                      {isBusy ? "…" : "Empty"}
                    </button>
                  </div>
                </div>

                <div className="mt-2">
                  <SpringFillBar
                    fillPct={entry.fillPct}
                    hasSensorError={entry.hasSensorError}
                    heightClassName="h-1.5"
                  />
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}

interface RecentAiEventsWidgetProps {
  events: WasteEvent[];
  canViewEvents: boolean;
}

export function RecentAiEventsWidget({
  events,
  canViewEvents,
}: RecentAiEventsWidgetProps) {
  return (
    <section className="bg-white rounded-2xl border border-[#E5EAE4] shadow-[0_1px_3px_rgba(20,83,45,0.04)] overflow-hidden">
      <div className="px-5 py-4 border-b border-[#EDF1EC] flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="h-8 w-8 rounded-xl bg-[#EEF5F0] text-[#14532D] flex items-center justify-center shrink-0">
            <Activity className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h2 className="font-jakarta text-sm font-bold text-[#14231B] truncate">
              Recent AI Waste Events
            </h2>
            <p className="text-[11px] text-[#65736A] truncate">
              Verified drop classifications &amp; sorting accuracy
            </p>
          </div>
        </div>

        {canViewEvents && (
          <span className="shrink-0 rounded-full bg-[#F3F6F3] border border-[#E2E8E2] px-2.5 py-0.5 text-[11px] font-semibold text-[#4E5E55]">
            {events.length} recent
          </span>
        )}
      </div>

      {!canViewEvents ? (
        <div className="p-6 text-center space-y-2">
          <div className="h-9 w-9 rounded-full bg-[#F3F6F3] text-[#65736A] flex items-center justify-center mx-auto">
            <Lock className="w-4 h-4" />
          </div>
          <p className="text-xs font-semibold text-[#1A2620]">
            Admin-Only Analytics Feed
          </p>
          <p className="text-[11px] text-[#65736A] max-w-xs mx-auto leading-relaxed">
            AI drop event logs require an ADMIN role. Station fill telemetry and
            bin emptying controls remain fully unlocked for field staff.
          </p>
        </div>
      ) : events.length === 0 ? (
        <div className="p-7 text-center text-xs text-[#65736A]">
          No AI waste drop events recorded yet.
        </div>
      ) : (
        <div className="p-3.5 max-h-[320px] overflow-y-auto space-y-2">
          {events.map((evt) => {
            const catKey =
              evt.waste_category in COMPARTMENT_META
                ? (evt.waste_category as WasteCategory)
                : null;
            const dotColor = catKey
              ? COMPARTMENT_META[catKey].dotColor
              : "#7D8881";
            const confPct = Math.round(
              evt.confidence <= 1 ? evt.confidence * 100 : evt.confidence,
            );

            return (
              <div
                key={evt.event_id}
                className="rounded-xl border border-[#EAEFEA] bg-[#FAFBFA] px-3.5 py-2.5 flex items-center justify-between gap-3 hover:bg-white transition-colors"
              >
                <div className="min-w-0 space-y-0.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span
                      className="h-2 w-2 rounded-full shrink-0"
                      style={{ backgroundColor: dotColor }}
                    />
                    <span className="text-xs font-bold capitalize text-[#1A2620]">
                      {evt.waste_category}
                    </span>
                    {evt.dropped_in_bin !== evt.waste_category && (
                      <span className="text-[11px] text-[#7A8880]">
                        → {evt.dropped_in_bin}
                      </span>
                    )}
                    <span className="rounded-md bg-[#EEF3EF] px-1.5 py-0.5 font-mono text-[10px] font-bold text-[#14532D]">
                      {confPct}% conf
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-[11px] text-[#6B7A71]">
                    <span className="font-mono font-semibold">
                      {evt.station_id}
                    </span>
                    <span>•</span>
                    <span className="inline-flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(evt.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </span>
                  </div>
                </div>

                <div className="shrink-0">
                  {evt.is_correct_sort === true ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#E9F4EC] border border-[#CBE4D3] px-2.5 py-0.5 text-[10px] font-bold text-[#14532D] whitespace-nowrap">
                      <CheckCircle2 className="w-3 h-3" />
                      Correct
                    </span>
                  ) : evt.is_correct_sort === false ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#FFF0EE] border border-[#FAD6D2] px-2.5 py-0.5 text-[10px] font-bold text-[#B93832] whitespace-nowrap">
                      <XCircle className="w-3 h-3" />
                      Mis-sorted
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-[#EFF2EF] border border-[#DCE3DC] px-2.5 py-0.5 text-[10px] font-semibold text-[#5E6D64] whitespace-nowrap">
                      Logged
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
