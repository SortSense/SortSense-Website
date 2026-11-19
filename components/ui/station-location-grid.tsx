'use client';

import React, { useState } from 'react';
import { StationLiveStatus } from '@/components/types';
import { StatusBadge, OperationalStatus } from './status-badge';
import { MapPin, Navigation, Signal } from 'lucide-react';

interface StationLocationGridProps {
  stations: StationLiveStatus[];
  selectedStationId: string | null;
  onSelectStation: (station: StationLiveStatus) => void;
}

export function StationLocationGrid({
  stations,
  selectedStationId,
  onSelectStation,
}: StationLocationGridProps) {
  const [filter, setFilter] = useState<'all' | 'green' | 'yellow' | 'red'>('all');

  const filteredStations = stations.filter((st) => {
    if (filter === 'all') return true;
    return st.status_color === filter;
  });

  const getStatusType = (color: 'green' | 'yellow' | 'red'): OperationalStatus => {
    if (color === 'red') return 'critical';
    if (color === 'yellow') return 'warning';
    return 'normal';
  };

  return (
    <div className="space-y-4">
      {/* Controls & Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-[#E1E8E1]">
        <div>
          <h3 className="font-bold text-sm text-[#202A25] font-display flex items-center gap-2">
            <Navigation className="w-4 h-4 text-[#176B45]" />
            Campus Station Fleet
          </h3>
          <p className="text-xs text-[#65736A]">
            Real-time telemetry and operational condition across deployed university units
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setFilter('all')}
            className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors ${
              filter === 'all'
                ? 'bg-[#176B45] text-white'
                : 'bg-[#EFF2EF] text-[#65736A] hover:bg-[#E9F3ED] hover:text-[#176B45]'
            }`}
          >
            All ({stations.length})
          </button>
          <button
            onClick={() => setFilter('green')}
            className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors ${
              filter === 'green'
                ? 'bg-[#48A868] text-white'
                : 'bg-[#E9F3ED] text-[#176B45] hover:bg-[#CDE3D5]'
            }`}
          >
            Normal (&lt;60%)
          </button>
          <button
            onClick={() => setFilter('yellow')}
            className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors ${
              filter === 'yellow'
                ? 'bg-[#C48419] text-white'
                : 'bg-[#FFF6E4] text-[#C48419] hover:bg-[#FDE8BF]'
            }`}
          >
            Warning (60–84%)
          </button>
          <button
            onClick={() => setFilter('red')}
            className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors ${
              filter === 'red'
                ? 'bg-[#C84F49] text-white'
                : 'bg-[#FFF0EE] text-[#C84F49] hover:bg-[#FADAD7]'
            }`}
          >
            Critical (≥85%)
          </button>
        </div>
      </div>

      {/* Grid of Stations */}
      {filteredStations.length === 0 ? (
        <div className="p-8 text-center bg-white rounded-xl border border-[#E1E8E1] text-xs text-[#65736A]">
          No stations currently match this operational filter.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredStations.map((station) => {
            const isSelected = selectedStationId === station.station_id;
            const statusType = getStatusType(station.status_color);

            return (
              <div
                key={station.station_id}
                onClick={() => onSelectStation(station)}
                className={`p-5 rounded-xl border cursor-pointer transition-all ${
                  isSelected
                    ? 'border-[#176B45] bg-[#E9F3ED]/30 ring-2 ring-[#176B45]/20 shadow-sm'
                    : 'border-[#E1E8E1] bg-white hover:border-[#CDE3D5] hover:shadow-xs'
                }`}
              >
                {/* Station Card Header */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <h4 className="font-bold text-sm text-[#202A25] font-display flex items-center gap-1.5">
                      {station.name}
                    </h4>
                    <div className="flex items-center gap-2 mt-1 text-xs text-[#65736A]">
                      <span className="font-mono bg-[#EFF2EF] px-1.5 py-0.5 rounded text-[11px] font-semibold">
                        {station.station_id}
                      </span>
                      {station.latitude && station.longitude ? (
                        <span className="flex items-center gap-1 text-[11px]">
                          <MapPin className="w-3 h-3 text-[#65736A]" />
                          {station.latitude.toFixed(4)}, {station.longitude.toFixed(4)}
                        </span>
                      ) : (
                        <span className="text-[11px] text-[#65736A]/70 italic">GPS Pending</span>
                      )}
                    </div>
                  </div>

                  <StatusBadge status={statusType} />
                </div>

                {/* Fill Percentage Mini Gauges */}
                <div className="grid grid-cols-4 gap-2 pt-3 border-t border-[#E1E8E1]/80 text-center">
                  <div className="p-1.5 rounded-lg bg-[#E9F6F5]">
                    <span className="text-[10px] text-[#65736A] font-medium block">Plastic</span>
                    <span className="text-xs font-mono font-bold text-[#38A6A0]">
                      {station.fill_levels.plastic}%
                    </span>
                  </div>
                  <div className="p-1.5 rounded-lg bg-[#FCF5E9]">
                    <span className="text-[10px] text-[#65736A] font-medium block">Paper</span>
                    <span className="text-xs font-mono font-bold text-[#D49A3A]">
                      {station.fill_levels.paper}%
                    </span>
                  </div>
                  <div className="p-1.5 rounded-lg bg-[#F0F3F7]">
                    <span className="text-[10px] text-[#65736A] font-medium block">Metal</span>
                    <span className="text-xs font-mono font-bold text-[#71849A]">
                      {station.fill_levels.metal}%
                    </span>
                  </div>
                  <div className="p-1.5 rounded-lg bg-[#F4F2F0]">
                    <span className="text-[10px] text-[#65736A] font-medium block">General</span>
                    <span className="text-xs font-mono font-bold text-[#776F68]">
                      {station.fill_levels.general}%
                    </span>
                  </div>
                </div>

                {/* Connectivity & Last Seen Footer */}
                <div className="flex items-center justify-between mt-3 text-[11px] text-[#65736A] pt-2 border-t border-[#E1E8E1]/40">
                  <span className="flex items-center gap-1.5">
                    <Signal
                      className={`w-3.5 h-3.5 ${
                        station.is_online ? 'text-[#48A868]' : 'text-[#C48419]'
                      }`}
                    />
                    {station.is_online ? 'ESP32 Online' : 'Heartbeat Lag'}
                  </span>

                  <span className="font-mono">
                    Updated{' '}
                    {new Date(station.updated_at).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
