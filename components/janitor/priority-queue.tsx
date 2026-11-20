'use client';

import React, { useState } from 'react';
import { StationLiveStatus, WasteCategory } from '@/components/types';
import { OperationsCard } from '@/components/ui/operations-card';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import { FillGauge } from '@/components/ui/fill-gauge';
import {
  AlertOctagon,
  Trash2,
  Clock,
  ShieldAlert,
  Info,
  Wrench,
  Sparkles,
} from 'lucide-react';

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

export function PriorityQueue({ stations }: PriorityQueueProps) {
  const [selectedEmptyItem, setSelectedEmptyItem] = useState<UrgentItem | null>(null);
  const [emptyNotes, setEmptyNotes] = useState('');

  // Derive individual compartment items with critical fill >= 85%
  const urgentItems: UrgentItem[] = [];
  const categories: WasteCategory[] = ['plastic', 'paper', 'metal', 'general'];

  stations.forEach((st) => {
    categories.forEach((cat) => {
      const fill = st.fill_levels[cat];
      if (fill !== null && fill !== undefined && fill >= 85) {
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
    <div className="space-y-6">
      {/* Priority Summary Banner */}
      <div className="bg-white rounded-xl border border-[#E1E8E1] p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#FFF0EE] text-[#C84F49] border border-[#FADAD7] flex items-center justify-center">
              <AlertOctagon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#202A25] font-display">
                Janitor Collection Priority Queue
              </h2>
              <p className="text-xs text-[#65736A]">
                Sorted by fill percentage descending — immediate servicing required
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-[#FFF0EE] text-[#C84F49] border border-[#FADAD7] font-mono">
              {urgentItems.length} Critical {urgentItems.length === 1 ? 'Bin' : 'Bins'} (≥85%)
            </span>
          </div>
        </div>
      </div>

      {/* Critical Queue List */}
      {urgentItems.length === 0 ? (
        <OperationsCard>
          <div className="p-8 text-center space-y-2">
            <div className="w-12 h-12 rounded-full bg-[#E9F3ED] text-[#176B45] flex items-center justify-center mx-auto">
              <Sparkles className="w-6 h-6" />
            </div>
            <h4 className="font-bold text-sm text-[#202A25] font-display">No Urgent Bins</h4>
            <p className="text-xs text-[#65736A] max-w-sm mx-auto">
              All monitored campus bins are currently operating below the critical 85% threshold.
            </p>
          </div>
        </OperationsCard>
      ) : (
        <div className="space-y-3">
          {urgentItems.map((item, idx) => (
            <div
              key={`${item.station_id}-${item.category}`}
              className="bg-white rounded-xl border border-[#FADAD7] p-5 shadow-2xs hover:shadow-xs transition-shadow flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              <div className="space-y-1.5 flex-1">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-[#FFF0EE] text-[#C84F49] font-mono font-bold text-xs flex items-center justify-center">
                    #{idx + 1}
                  </span>
                  <h4 className="font-bold text-sm text-[#202A25] font-display">
                    {item.station_name}
                  </h4>
                  <span className="font-mono text-xs bg-[#EFF2EF] px-1.5 py-0.5 rounded text-[#65736A]">
                    {item.station_id}
                  </span>
                  <StatusBadge status="critical" />
                </div>

                <div className="w-full max-w-md pt-2">
                  <FillGauge category={item.category} fillPct={item.fillPct} />
                </div>

                <div className="flex items-center gap-3 text-[11px] text-[#65736A] pt-1">
                  <span className="flex items-center gap-1 font-mono">
                    <Clock className="w-3 h-3 text-[#65736A]" />
                    Telemetry reading:{' '}
                    {item.updatedAt
                      ? new Date(item.updatedAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })
                      : 'No reading'}
                  </span>
                </div>
              </div>

              {/* Action Button */}
              <div className="shrink-0 flex items-center gap-2">
                <Button
                  variant="danger"
                  size="md"
                  onClick={() => setSelectedEmptyItem(item)}
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
        subtitle="Hardware alerts: Bins flagged with SENSOR_ERROR require physical inspection"
      >
        <div className="p-4 rounded-lg bg-[#F7F8F4] border border-[#E1E8E1] space-y-2 text-xs text-[#65736A]">
          <div className="flex items-start gap-2">
            <Info className="w-4 h-4 text-[#176B45] shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              <strong>Sensor Error vs. Fill Percentage:</strong> When a ToF sensor reports a hardware fault
              or break-beam occlusion, the database records <code>operational_status = &apos;SENSOR_ERROR&apos;</code>.
              Sensor errors are never displayed as 0% or 100% full to prevent false assumptions.
            </p>
          </div>
        </div>
      </OperationsCard>

      {/* Empty Bin Modal Dialog */}
      {selectedEmptyItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-5 border border-[#E1E8E1] shadow-xl">
            <div className="flex items-center justify-between border-b border-[#E1E8E1] pb-3">
              <div className="flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-[#C84F49]" />
                <h3 className="font-bold text-sm text-[#202A25] font-display">
                  Confirm Bin Emptying
                </h3>
              </div>
              <button
                onClick={() => setSelectedEmptyItem(null)}
                className="text-xs text-[#65736A] hover:text-[#202A25]"
              >
                ✕
              </button>
            </div>

            <div className="p-3 rounded-xl bg-[#F7F8F4] border border-[#E1E8E1] space-y-1.5 text-xs text-[#202A25]">
              <div className="flex justify-between">
                <span className="text-[#65736A]">Target Station:</span>
                <span className="font-bold">{selectedEmptyItem.station_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#65736A]">Compartment:</span>
                <span className="font-bold capitalize">{selectedEmptyItem.category}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#65736A]">Fill Before Emptying:</span>
                <span className="font-mono font-bold text-[#C84F49]">
                  {selectedEmptyItem.fillPct}%
                </span>
              </div>
            </div>

            {/* Status Notice: Backend RPC Integration In Progress */}
            <div className="p-3.5 rounded-xl bg-[#FFF6E4] border border-[#FDE8BF] text-xs space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-[#C48419]">
                <ShieldAlert className="w-4 h-4 shrink-0 text-[#C48419]" />
                <span>Backend RPC Integration In Progress</span>
              </div>
              <p className="leading-relaxed text-[11px] text-[#874B00]">
                Emptying operations require an authenticated PostgreSQL RPC transaction to atomically update{' '}
                <code>bin_status</code> and record <code>bin_emptying_events</code>. Database mutation controls are temporarily locked in the UI.
              </p>
            </div>

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
                disabled={true}
                className="w-full px-3 py-2 text-xs border border-[#E1E8E1] rounded-lg bg-[#F7F8F4] text-[#65736A] cursor-not-allowed"
              />
            </div>

            {/* Modal Actions */}
            <div className="flex justify-end gap-2 pt-2 border-t border-[#E1E8E1]">
              <Button
                variant="secondary"
                size="md"
                onClick={() => setSelectedEmptyItem(null)}
              >
                Close
              </Button>
              <Button
                variant="danger"
                size="md"
                disabled={true}
                title="Backend RPC Integration In Progress"
                className="opacity-50 cursor-not-allowed"
              >
                Confirm &amp; Empty Bin (Locked)
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
