'use client';

import React from 'react';
import { StationLiveStatus } from '@/components/types';
import { OperationsCard } from '@/components/ui/operations-card';
import { StatusBadge, resolveStationOperationalStatus } from '@/components/ui/status-badge';
import {
  computeStationSensorHealth,
  type StationSensorHealth,
} from '@/lib/sensor-health';
import {
  Cpu,
  Wifi,
  Clock,
  Info,
} from 'lucide-react';

interface HardwareDiagnosticsProps {
  stations: StationLiveStatus[];
}

function formatSensorReadingsSummary(
  st: StationLiveStatus,
  health: StationSensorHealth,
): string {
  if (health.totalBins === 0) {
    return '0 configured bins';
  }

  const faultSuffix =
    health.sensorErrors > 0
      ? ` · ${health.sensorErrors} fault${health.sensorErrors === 1 ? '' : 's'}`
      : '';

  if (health.isLive) {
    const parts = [`${health.activeToF} / ${health.totalBins} active ToF`];
    if (health.simulatedReadings > 0) {
      parts.push(`${health.simulatedReadings} simulated`);
    }
    if (health.legacyReadings > 0) {
      parts.push(`${health.legacyReadings} legacy`);
    }
    return `${parts.join(' · ')}${faultSuffix}`;
  }

  if (st.is_stale) {
    const staleDetail =
      health.cachedReadings > 0
        ? ` (${health.cachedReadings} stale cached)`
        : ' (stale)';
    return `0 / ${health.totalBins} active${staleDetail}${faultSuffix}`;
  }

  const cachedDetail =
    health.cachedReadings > 0 ? ` (${health.cachedReadings} cached)` : '';
  return `0 / ${health.totalBins} active${cachedDetail}${faultSuffix}`;
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
                  <th className="py-2.5 px-3">Device Registration</th>
                  <th className="py-2.5 px-3">Target Unit</th>
                  <th className="py-2.5 px-3">Telemetry Health</th>
                  <th className="py-2.5 px-3">Sensor Readings</th>
                  <th className="py-2.5 px-3">Last Bin Reading</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E1E8E1] text-[#202A25]">
                {stations.map((st) => {
                  const resolved = resolveStationOperationalStatus(st);
                  const health = computeStationSensorHealth(st);
                  const readingSummary = formatSensorReadingsSummary(st, health);

                  return (
                    <tr key={st.station_id} className="hover:bg-[#E9F3ED]/30 transition-colors">
                      <td className="py-3 px-3 font-mono text-xs flex items-center gap-2">
                        <Wifi
                          className={`w-3.5 h-3.5 ${
                            st.has_sensor_error
                              ? 'text-[#9A3412]'
                              : health.isLive
                              ? 'text-[#48A868]'
                              : 'text-[#65736A]'
                          }`}
                        />
                        <span className="text-[#65736A]">Unverified (devices restricted)</span>
                      </td>
                      <td className="py-3 px-3 font-medium">
                        {st.name}{' '}
                        <span className="font-mono text-[11px] text-[#65736A]">
                          ({st.station_id})
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <StatusBadge status={resolved.status} label={resolved.label} />
                      </td>
                      <td className="py-3 px-3">
                        <span className="font-mono text-[11px] text-[#65736A]">
                          {readingSummary} (sensors restricted)
                        </span>
                      </td>
                      <td className="py-3 px-3 font-mono text-[11px] text-[#65736A]">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-[#65736A]" />
                          {st.updated_at
                            ? `${new Date(st.updated_at).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}${st.is_stale ? ' (Stale)' : ''}`
                            : 'No reading'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
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
