'use client';

import React from 'react';
import { WasteEvent } from '@/components/types';
import { OperationsCard } from '@/components/ui/operations-card';
import {
  FileCheck2,
  CheckCircle2,
  XCircle,
  Clock,
} from 'lucide-react';

interface DisposalHistoryViewProps {
  events: WasteEvent[];
  isLoading?: boolean;
}

const CATEGORY_COLORS: Record<string, string> = {
  plastic: '#38A6A0',
  paper: '#D49A3A',
  metal: '#71849A',
  general: '#776F68',
};

export function DisposalHistoryView({ events, isLoading = false }: DisposalHistoryViewProps) {
  if (isLoading) {
    return (
      <OperationsCard title="AI Verified Waste Drops" subtitle="Loading live drop events...">
        <div className="p-8 text-center text-xs text-[#65736A] animate-pulse">
          Retrieving verified drop logs from database...
        </div>
      </OperationsCard>
    );
  }

  return (
    <OperationsCard
      title={
        <div className="flex items-center gap-2">
          <FileCheck2 className="w-4 h-4 text-[#176B45]" />
          <span>AI Verified Waste Disposal Log</span>
        </div>
      }
      subtitle="Ingested from AI inference backend and confirmed via physical IR break-beam sensor"
    >
      {events.length === 0 ? (
        <div className="p-8 text-center text-xs text-[#65736A]">
          No waste drop events recorded today yet.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F7F8F4] text-[#65736A] uppercase tracking-wider font-semibold border-b border-[#E1E8E1] font-display">
              <tr>
                <th className="py-2.5 px-3">Timestamp</th>
                <th className="py-2.5 px-3">Station</th>
                <th className="py-2.5 px-3">AI Prediction</th>
                <th className="py-2.5 px-3">Deposited In</th>
                <th className="py-2.5 px-3">Confidence</th>
                <th className="py-2.5 px-3">Result</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E1E8E1] text-[#202A25]">
              {events.map((evt) => (
                <tr key={evt.event_id} className="hover:bg-[#E9F3ED]/30 transition-colors">
                  <td className="py-3 px-3 text-[#65736A] font-mono text-[11px]">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-[#65736A]" />
                      {new Date(evt.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </span>
                  </td>
                  <td className="py-3 px-3 font-mono font-semibold">{evt.station_id}</td>
                  <td className="py-3 px-3 capitalize">
                    <span className="inline-flex items-center gap-1.5 font-medium">
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{
                          backgroundColor: CATEGORY_COLORS[evt.waste_category] || '#65736A',
                        }}
                      />
                      {evt.waste_category}
                    </span>
                  </td>
                  <td className="py-3 px-3 capitalize font-medium text-[#65736A]">
                    {evt.dropped_in_bin}
                  </td>
                  <td className="py-3 px-3 font-mono font-semibold">
                    {(evt.confidence * 100).toFixed(0)}%
                  </td>
                  <td className="py-3 px-3">
                    {evt.is_correct_sort === true ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#E9F3ED] text-[#176B45] border border-[#CDE3D5]">
                        <CheckCircle2 className="w-3 h-3" />
                        Correct Sort
                      </span>
                    ) : evt.is_correct_sort === false ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#FFF0EE] text-[#C84F49] border border-[#FADAD7]">
                        <XCircle className="w-3 h-3" />
                        Sorting Error
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#EFF2EF] text-[#65736A] border border-[#E1E8E1]">
                        Recorded
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </OperationsCard>
  );
}
