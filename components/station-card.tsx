'use client';

import React from 'react';
import { StationLiveStatus } from './types';
import { AlertCircle, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface StationCardProps {
  station: StationLiveStatus;
  isSelected?: boolean;
  onSelect: (station: StationLiveStatus) => void;
}

export default function StationCard({
  station,
  isSelected,
  onSelect,
}: StationCardProps) {
  const getBadge = (color: 'green' | 'yellow' | 'red') => {
    switch (color) {
      case 'red':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-100 text-red-700">
            <AlertCircle className="w-3 h-3" />
            Critical
          </span>
        );
      case 'yellow':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-yellow-100 text-yellow-800">
            <AlertTriangle className="w-3 h-3" />
            Warning
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-700">
            <CheckCircle2 className="w-3 h-3" />
            Normal
          </span>
        );
    }
  };

  return (
    <div
      onClick={() => onSelect(station)}
      className={`p-4 rounded-xl border cursor-pointer transition-all ${
        isSelected
          ? 'border-emerald-600 bg-emerald-50/40 shadow-sm ring-1 ring-emerald-600'
          : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-xs'
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <h4 className="text-sm font-bold text-gray-900">{station.name}</h4>
          <span className="text-xs font-mono text-gray-400">{station.station_id}</span>
        </div>
        {getBadge(station.status_color)}
      </div>

      <div className="grid grid-cols-4 gap-1.5 mt-3 pt-2 border-t border-gray-100 text-center">
        <div>
          <span className="text-[10px] text-gray-400 block">Plastic</span>
          <span className="text-xs font-semibold text-blue-600 font-mono">
            {station.fill_levels.plastic}%
          </span>
        </div>
        <div>
          <span className="text-[10px] text-gray-400 block">Paper</span>
          <span className="text-xs font-semibold text-amber-600 font-mono">
            {station.fill_levels.paper}%
          </span>
        </div>
        <div>
          <span className="text-[10px] text-gray-400 block">Metal</span>
          <span className="text-xs font-semibold text-slate-600 font-mono">
            {station.fill_levels.metal}%
          </span>
        </div>
        <div>
          <span className="text-[10px] text-gray-400 block">General</span>
          <span className="text-xs font-semibold text-gray-600 font-mono">
            {station.fill_levels.general}%
          </span>
        </div>
      </div>
    </div>
  );
}
