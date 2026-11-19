'use client';

import React from 'react';
import { StationLiveStatus } from '@/components/types';
import { OperationsCard } from '@/components/ui/operations-card';
import { StatusBadge } from '@/components/ui/status-badge';
import {
  Cpu,
  Wifi,
  Clock,
  Info,
} from 'lucide-react';

interface HardwareDiagnosticsProps {
  stations: StationLiveStatus[];
}

export function HardwareDiagnostics({ stations }: HardwareDiagnosticsProps) {
  return (
    <div className="space-y-6">
      <OperationsCard
        title={
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-[#176B45]" />
            <span>Hardware Controllers &amp; Sensor Telemetry</span>
          </div>
        }
        subtitle="Live ESP32-S3 controller connectivity and ToF distance sensor telemetry stream"
      >
        <div className="space-y-4">
          {/* Hardware Stream Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F7F8F4] text-[#65736A] uppercase tracking-wider font-semibold border-b border-[#E1E8E1] font-display">
                <tr>
                  <th className="py-2.5 px-3">Station Controller</th>
                  <th className="py-2.5 px-3">Target Unit</th>
                  <th className="py-2.5 px-3">Telemetry Health</th>
                  <th className="py-2.5 px-3">Sensors Monitored</th>
                  <th className="py-2.5 px-3">Heartbeat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E1E8E1] text-[#202A25]">
                {stations.map((st) => (
                  <tr key={st.station_id} className="hover:bg-[#E9F3ED]/30 transition-colors">
                    <td className="py-3 px-3 font-mono font-bold flex items-center gap-2">
                      <Wifi
                        className={`w-3.5 h-3.5 ${
                          st.is_online ? 'text-[#48A868]' : 'text-[#C48419]'
                        }`}
                      />
                      <span>ESP32-{st.station_id}</span>
                    </td>
                    <td className="py-3 px-3 font-medium">{st.name}</td>
                    <td className="py-3 px-3">
                      <StatusBadge status={st.is_online ? 'normal' : 'offline'} label={st.is_online ? 'Online' : 'Lag'} />
                    </td>
                    <td className="py-3 px-3">
                      <span className="font-mono text-[11px] text-[#65736A]">
                        4x ToF Distance + 4x IR Break-beam
                      </span>
                    </td>
                    <td className="py-3 px-3 font-mono text-[11px] text-[#65736A]">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-[#65736A]" />
                        {new Date(st.updated_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Transparent Architectural Notice */}
          <div className="p-4 rounded-xl bg-[#F7F8F4] border border-[#E1E8E1] space-y-1.5 text-xs text-[#65736A]">
            <div className="flex items-center gap-2 font-bold text-[#202A25]">
              <Info className="w-4 h-4 text-[#176B45]" />
              <span>Database Architecture Status: devices &amp; sensors entities</span>
            </div>
            <p className="leading-relaxed">
              The live telemetry is ingested from Fabio&apos;s ESP32-S3 via <code>POST /api/telemetry/fill-levels</code>.
              Direct querying of individual MAC addresses from the <code>devices</code> table and hardware serial numbers
              from <code>sensors</code> will be populated once authenticated hardware registration endpoints are connected.
            </p>
          </div>
        </div>
      </OperationsCard>
    </div>
  );
}
