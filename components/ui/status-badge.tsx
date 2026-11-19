import React from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle, Wrench, WifiOff } from 'lucide-react';

export type OperationalStatus = 'normal' | 'warning' | 'critical' | 'sensor-error' | 'offline';

interface StatusBadgeProps {
  status: OperationalStatus;
  label?: string;
  className?: string;
}

export function StatusBadge({ status, label, className = '' }: StatusBadgeProps) {
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
          <span>{label || 'Sensor Fault'}</span>
        </span>
      );
    case 'offline':
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#EFF2EF] text-[#65736A] border border-[#E1E8E1] ${className}`}
        >
          <WifiOff className="w-3.5 h-3.5 shrink-0" />
          <span>{label || 'Offline'}</span>
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
