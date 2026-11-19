'use client';

import React, { useState } from 'react';
import { StationLiveStatus, StatusColor } from './types';
import { MapPin, Navigation, Layers } from 'lucide-react';

interface CampusMapProps {
  stations: StationLiveStatus[];
  selectedStationId: string | null;
  onSelectStation: (station: StationLiveStatus) => void;
}

export default function CampusMap({
  stations,
  selectedStationId,
  onSelectStation,
}: CampusMapProps) {
  const [filterColor, setFilterColor] = useState<StatusColor | 'all'>('all');

  // Map geographic bounding box for coordinates:
  // Lat: 24.7940 to 24.7980 (~400m)
  // Lng: 120.9900 to 120.9955 (~550m)
  const minLat = 24.7940;
  const maxLat = 24.7980;
  const minLng = 120.9900;
  const maxLng = 120.9955;

  const projectToMap = (lat: number, lng: number) => {
    const x = ((lng - minLng) / (maxLng - minLng)) * 100;
    // Invert Y because latitude goes north/up
    const y = 100 - ((lat - minLat) / (maxLat - minLat)) * 100;
    return {
      x: Math.max(10, Math.min(90, x)),
      y: Math.max(10, Math.min(90, y)),
    };
  };

  const filteredStations = stations.filter((s) => {
    if (filterColor === 'all') return true;
    return s.status_color === filterColor;
  });

  const getPinColorClass = (color: StatusColor) => {
    switch (color) {
      case 'red':
        return {
          bg: 'bg-red-500',
          ring: 'ring-red-400',
          pulse: 'bg-red-400',
          text: 'text-red-700',
          border: 'border-red-500',
        };
      case 'yellow':
        return {
          bg: 'bg-yellow-500',
          ring: 'ring-yellow-400',
          pulse: 'bg-yellow-400',
          text: 'text-yellow-700',
          border: 'border-yellow-500',
        };
      default:
        return {
          bg: 'bg-emerald-500',
          ring: 'ring-emerald-400',
          pulse: 'bg-emerald-400',
          text: 'text-emerald-700',
          border: 'border-emerald-500',
        };
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-4">
      {/* Map Header and Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-4">
        <div>
          <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
            <Navigation className="w-4 h-4 text-emerald-700" />
            Interactive Campus Bin Map
          </h3>
          <p className="text-xs text-gray-500">
            Real-time fill indicators for all deployed SortSense stations
          </p>
        </div>

        {/* Filter Badges */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setFilterColor('all')}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
              filterColor === 'all'
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            All ({stations.length})
          </button>
          <button
            onClick={() => setFilterColor('green')}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 ${
              filterColor === 'green'
                ? 'bg-emerald-700 text-white'
                : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            Normal (&lt;60%)
          </button>
          <button
            onClick={() => setFilterColor('yellow')}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 ${
              filterColor === 'yellow'
                ? 'bg-yellow-600 text-white'
                : 'bg-yellow-50 text-yellow-800 hover:bg-yellow-100'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-yellow-500" />
            Warning (60-84%)
          </button>
          <button
            onClick={() => setFilterColor('red')}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 ${
              filterColor === 'red'
                ? 'bg-red-700 text-white'
                : 'bg-red-50 text-red-800 hover:bg-red-100'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-red-500" />
            Critical (≥85%)
          </button>
        </div>
      </div>

      {/* SVG Campus Map Canvas */}
      <div className="relative w-full h-[400px] md:h-[480px] bg-slate-50 rounded-xl overflow-hidden border border-slate-200 select-none">
        {/* Background Campus Topography & Buildings */}
        <svg
          className="absolute inset-0 w-full h-full"
          preserveAspectRatio="none"
          viewBox="0 0 1000 600"
        >
          <defs>
            <linearGradient id="grassGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#f0fdf4" />
              <stop offset="100%" stopColor="#ecfdf5" />
            </linearGradient>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#e2e8f0" strokeWidth="0.8" />
            </pattern>
          </defs>

          {/* Grid base */}
          <rect width="1000" height="600" fill="#f8fafc" />
          <rect width="1000" height="600" fill="url(#grid)" />

          {/* Campus Greenery Zones */}
          <path
            d="M 50 150 Q 200 80 400 120 T 700 80 L 800 250 L 550 300 L 200 220 Z"
            fill="url(#grassGrad)"
            opacity="0.8"
          />
          <path
            d="M 250 350 Q 450 300 750 380 T 950 480 L 700 580 L 200 550 Z"
            fill="url(#grassGrad)"
            opacity="0.8"
          />

          {/* Campus Roads / Walkways */}
          <path
            d="M 0 300 L 1000 300"
            stroke="#cbd5e1"
            strokeWidth="24"
            fill="none"
            strokeLinecap="round"
          />
          <path
            d="M 0 300 L 1000 300"
            stroke="#ffffff"
            strokeWidth="2"
            strokeDasharray="12 12"
            fill="none"
          />

          <path
            d="M 420 0 L 420 600"
            stroke="#cbd5e1"
            strokeWidth="18"
            fill="none"
          />
          <path
            d="M 750 0 L 750 600"
            stroke="#cbd5e1"
            strokeWidth="18"
            fill="none"
          />

          {/* Campus Buildings */}
          {/* Delta Building */}
          <g>
            <rect x="180" y="340" width="180" height="110" rx="10" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="2" />
            <text x="270" y="400" textAnchor="middle" fill="#475569" fontSize="13" fontWeight="bold" fontFamily="sans-serif">
              Delta Building
            </text>
            <text x="270" y="420" textAnchor="middle" fill="#64748b" fontSize="10" fontFamily="sans-serif">
              Dept. of EE & CS
            </text>
          </g>

          {/* Main Library */}
          <g>
            <rect x="480" y="140" width="200" height="130" rx="12" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="2" />
            <text x="580" y="210" textAnchor="middle" fill="#475569" fontSize="14" fontWeight="bold" fontFamily="sans-serif">
              Main Library
            </text>
            <text x="580" y="230" textAnchor="middle" fill="#64748b" fontSize="10" fontFamily="sans-serif">
              Study Hub & Media Center
            </text>
          </g>

          {/* Engineering Hall */}
          <g>
            <rect x="120" y="110" width="160" height="90" rx="8" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="2" />
            <text x="200" y="160" textAnchor="middle" fill="#475569" fontSize="12" fontWeight="bold" fontFamily="sans-serif">
              Engineering I
            </text>
          </g>

          {/* Student Center & Cafeteria */}
          <g>
            <rect x="790" y="360" width="160" height="130" rx="10" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="2" />
            <text x="870" y="430" textAnchor="middle" fill="#475569" fontSize="13" fontWeight="bold" fontFamily="sans-serif">
              Student Center
            </text>
            <text x="870" y="450" textAnchor="middle" fill="#64748b" fontSize="10" fontFamily="sans-serif">
              Cafeteria & Lounge
            </text>
          </g>

          {/* Central Plaza / Water Feature */}
          <circle cx="580" cy="380" r="45" fill="#e0f2fe" stroke="#38bdf8" strokeWidth="2" />
          <text x="580" y="385" textAnchor="middle" fill="#0284c7" fontSize="11" fontWeight="bold">
            Campus Plaza
          </text>
        </svg>

        {/* Live Station Pins (Rendered on top of Map) */}
        {filteredStations.map((station) => {
          const { x, y } = projectToMap(station.latitude, station.longitude);
          const isSelected = selectedStationId === station.station_id;
          const pinStyle = getPinColorClass(station.status_color);

          return (
            <div
              key={station.station_id}
              onClick={() => onSelectStation(station)}
              style={{ left: `${x}%`, top: `${y}%` }}
              className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer group z-20"
            >
              {/* Pulsing Beacon Ring */}
              <span
                className={`absolute inset-0 rounded-full animate-ping opacity-75 ${pinStyle.pulse}`}
                style={{ width: isSelected ? '40px' : '28px', height: isSelected ? '40px' : '28px' }}
              />

              {/* Pin Icon / Marker */}
              <div
                className={`relative flex items-center justify-center rounded-full text-white shadow-lg transition-transform duration-200 group-hover:scale-125 ${
                  pinStyle.bg
                } ${
                  isSelected
                    ? 'w-10 h-10 ring-4 ring-offset-2 ring-emerald-500 scale-110'
                    : 'w-7 h-7 ring-2 ring-white'
                }`}
              >
                <MapPin className={`${isSelected ? 'w-5 h-5' : 'w-4 h-4'}`} />
              </div>

              {/* Hover / Selected Station Popup Tag */}
              <div
                className={`absolute left-1/2 -translate-x-1/2 bottom-full mb-2 whitespace-nowrap bg-gray-900 text-white text-[11px] font-semibold py-1 px-2.5 rounded-lg shadow-xl pointer-events-none transition-all ${
                  isSelected ? 'opacity-100 visible scale-100' : 'opacity-0 invisible group-hover:opacity-100 group-hover:visible'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      station.status_color === 'red'
                        ? 'bg-red-400'
                        : station.status_color === 'yellow'
                        ? 'bg-yellow-400'
                        : 'bg-emerald-400'
                    }`}
                  />
                  <span>{station.name}</span>
                  <span className="font-mono text-gray-400">({station.max_fill_pct}%)</span>
                </div>
                {/* Arrow */}
                <div className="absolute left-1/2 -translate-x-1/2 top-full border-4 border-transparent border-t-gray-900" />
              </div>
            </div>
          );
        })}

        {/* Map Legend Overlay */}
        <div className="absolute bottom-3 left-3 bg-white/95 backdrop-blur-xs p-2.5 rounded-xl border border-gray-200 shadow-sm text-[11px] text-gray-700 space-y-1 z-10">
          <div className="font-semibold text-gray-900 flex items-center gap-1.5 mb-1">
            <Layers className="w-3.5 h-3.5 text-gray-500" />
            Station Status Color Rules
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span>&lt; 60% Fill (Normal)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
            <span>60–84% Fill (Warning)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
            <span>≥ 85% Fill (Critical)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
