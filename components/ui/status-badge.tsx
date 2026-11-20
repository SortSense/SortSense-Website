import React from 'react';
import { CheckCircle2, AlertTriangle, CircleX, CircleHelp, Wrench, WifiOff, AlertCircle } from 'lucide-react';
import type { StationLiveStatus } from '@/components/types';

export type Availability = 'available' | 'nearly-full' | 'full' | 'unknown';
export type OperationalStatus = 'normal' | 'warning' | 'critical' | 'sensor-error' | 'offline' | 'unavailable' | Availability;

export function resolveStationOperationalStatus(
  station: StationLiveStatus,
): { status: OperationalStatus; label?: string } {
  if (station.has_sensor_error) {
    return { status: 'sensor-error', label: 'SENSOR ERROR' };
  }
  if (!station.is_online && (station.connectivity_status === 'UNKNOWN' || !station.updated_at)) {
    return { status: 'unavailable', label: 'UNKNOWN' };
  }
  if (!station.is_online) {
    return { status: 'offline', label: station.is_stale ? 'OFFLINE (Stale)' : 'OFFLINE' };
  }
  if (station.status_color === 'red') {
    return { status: 'critical' };
  }
  if (station.status_color === 'yellow') {
    return { status: 'warning' };
  }
  if (station.status_color === 'green') {
    return { status: 'normal' };
  }
  return { status: 'unavailable', label: 'UNKNOWN' };
}

export const statusLabels: Record<Availability, string> = {
  available: 'Available',
  'nearly-full': 'Nearly full',
  full: 'Full',
  unknown: 'Status unavailable',
};

interface StatusBadgeProps {
  status: OperationalStatus;
  label?: string;
  className?: string;
}

export function StatusBadge({ status, label, className = '' }: StatusBadgeProps) {
  // Support original sort-sense-1.0 public Availability statuses
  if (status === 'available' || status === 'nearly-full' || status === 'full' || status === 'unknown') {
    const Icon =
      status === 'available'
        ? CheckCircle2
        : status === 'nearly-full'
          ? AlertTriangle
          : status === 'full'
            ? CircleX
            : CircleHelp;

    return (
      <span className={`status-badge status-${status} ${className}`}>
        <Icon size={13} />
        {label || statusLabels[status]}
      </span>
    );
  }

  // Support dashboard operational statuses
  switch (status) {
    case 'critical':
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#FFF0EE] text-[#C84F49] border border-[#FADAD7] ${className}`}
        >
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{label || 'Critical (≥85%)'}</span>
        </span>
      );
    case 'warning':
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#FFF6E4] text-[#C48419] border border-[#FDE8BF] ${className}`}
        >
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          <span>{label || 'Warning (60–84%)'}</span>
        </span>
      );
    case 'sensor-error':
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#FFEDE5] text-[#9A3412] border border-[#FDCBB9] ${className}`}
        >
          <Wrench className="w-3.5 h-3.5 shrink-0" />
          <span>{label || 'SENSOR ERROR'}</span>
        </span>
      );
    case 'unavailable':
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#EFF2EF] text-[#65736A] border border-[#E1E8E1] ${className}`}
        >
          <CircleHelp className="w-3.5 h-3.5 shrink-0" />
          <span>{label || 'UNKNOWN'}</span>
        </span>
      );
    case 'offline':
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#EFF2EF] text-[#65736A] border border-[#E1E8E1] ${className}`}
        >
          <WifiOff className="w-3.5 h-3.5 shrink-0" />
          <span>{label || 'OFFLINE'}</span>
        </span>
      );
    case 'normal':
    default:
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#E9F3ED] text-[#176B45] border border-[#CDE3D5] ${className}`}
        >
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          <span>{label || 'Normal (<60%)'}</span>
        </span>
      );
  }
}
