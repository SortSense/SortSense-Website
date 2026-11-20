'use client';

import dynamic from 'next/dynamic';
import type { StationMapProps } from './station-map';

export const DynamicStationMap = dynamic<StationMapProps>(
  () => import('./station-map').then((mod) => mod.StationMap),
  {
    ssr: false,
    loading: () => (
      <div className="station-map flex flex-col items-center justify-center bg-[#e5eae5] text-[#65736a] text-xs w-full h-full animate-pulse">
        <span>Loading campus map…</span>
      </div>
    ),
  },
);
