import React from 'react';

export type WasteCategory = 'plastic' | 'paper' | 'metal' | 'general';

interface FillGaugeProps {
  category: WasteCategory;
  fillPct: number | null;
  label?: string;
  hasSensorError?: boolean;
  className?: string;
}

const CATEGORY_STYLES: Record<
  WasteCategory,
  { label: string; baseColor: string; bgSoft: string }
> = {
  plastic: {
    label: 'Plastic',
    baseColor: '#38A6A0',
    bgSoft: '#E9F6F5',
  },
  paper: {
    label: 'Paper',
    baseColor: '#D49A3A',
    bgSoft: '#FCF5E9',
  },
  metal: {
    label: 'Metal',
    baseColor: '#71849A',
    bgSoft: '#F0F3F7',
  },
  general: {
    label: 'General Waste',
    baseColor: '#776F68',
    bgSoft: '#F4F2F0',
  },
};

export function FillGauge({
  category,
  fillPct,
  label,
  hasSensorError = false,
  className = '',
}: FillGaugeProps) {
  const config = CATEGORY_STYLES[category];
  const isUnavailable = fillPct === null || Number.isNaN(fillPct);
  const numericPct = isUnavailable ? 0 : fillPct;
  const isCritical = !isUnavailable && numericPct >= 85;
  const isWarning = !isUnavailable && numericPct >= 60 && numericPct < 85;

  const barColor = hasSensorError
    ? '#9A3412'
    : isUnavailable
    ? '#CBD5E1'
    : isCritical
    ? '#C84F49'
    : isWarning
    ? '#C48419'
    : config.baseColor;

  return (
    <div className={`space-y-1.5 ${className}`}>
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5">
          <span
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ backgroundColor: config.baseColor }}
          />
          <span className="font-semibold text-[#202A25]">{label || config.label}</span>
        </div>

        <div className="flex items-center gap-2">
          {hasSensorError ? (
            <span className="text-[11px] font-mono font-bold text-[#9A3412] bg-[#FFEDE5] px-1.5 py-0.5 rounded">
              SENSOR ERROR
            </span>
          ) : isUnavailable ? (
            <span className="text-[11px] font-mono font-semibold text-[#65736A]">
              N/A
            </span>
          ) : (
            <span
              className={`font-mono font-bold text-xs ${
                isCritical ? 'text-[#C84F49]' : isWarning ? 'text-[#C48419]' : 'text-[#202A25]'
              }`}
            >
              {numericPct.toFixed(0)}%
            </span>
          )}
        </div>
      </div>

      {/* Track */}
      <div className="w-full bg-[#EFF2EF] rounded-full h-2.5 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{
            width: hasSensorError ? '100%' : isUnavailable ? '0%' : `${Math.min(100, Math.max(0, numericPct))}%`,
            backgroundColor: barColor,
            opacity: hasSensorError ? 0.35 : 1,
          }}
        />
      </div>
    </div>
  );
}
