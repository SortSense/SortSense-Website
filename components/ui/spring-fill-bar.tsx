"use client";

import React from "react";
import { animated, useSpring } from "@react-spring/web";
import type { WasteCategory } from "@/components/types";

export const COMPARTMENT_META: Record<
  WasteCategory,
  {
    label: string;
    shortLabel: string;
    dotColor: string;
    softBg: string;
  }
> = {
  plastic: {
    label: "Plastic",
    shortLabel: "Plastic",
    dotColor: "#38A6A0",
    softBg: "#E9F6F5",
  },
  paper: {
    label: "Paper",
    shortLabel: "Paper",
    dotColor: "#D49A3A",
    softBg: "#FCF5E9",
  },
  metal: {
    label: "Metal",
    shortLabel: "Metal",
    dotColor: "#71849A",
    softBg: "#F0F3F7",
  },
  general: {
    label: "General",
    shortLabel: "General",
    dotColor: "#776F68",
    softBg: "#F4F2F0",
  },
};

export interface FillThresholdStyle {
  barColor: string;
  textColor: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  statusText: string;
  level: "offline" | "error" | "normal" | "warning" | "critical";
}

export function getFillThresholdStyle(
  fillPct: number | null | undefined,
  hasSensorError = false,
): FillThresholdStyle {
  if (hasSensorError) {
    return {
      barColor: "#9A3412",
      textColor: "#9A3412",
      badgeBg: "#FFEDE5",
      badgeText: "#9A3412",
      badgeBorder: "#FDCBB9",
      statusText: "Sensor Error / N/A",
      level: "error",
    };
  }
  if (fillPct === null || fillPct === undefined || Number.isNaN(fillPct)) {
    return {
      barColor: "#CBD5E1",
      textColor: "#65736A",
      badgeBg: "#F1F4F1",
      badgeText: "#5B6961",
      badgeBorder: "#DCE4DC",
      statusText: "Sensor Offline / N/A",
      level: "offline",
    };
  }
  if (fillPct >= 80) {
    return {
      barColor: "#DC4C46",
      textColor: "#B93832",
      badgeBg: "#FFF0EE",
      badgeText: "#B93832",
      badgeBorder: "#FAD6D2",
      statusText: "Critical (≥80%)",
      level: "critical",
    };
  }
  if (fillPct >= 50) {
    return {
      barColor: "#D98A1C",
      textColor: "#9A6310",
      badgeBg: "#FFF6E4",
      badgeText: "#9A6310",
      badgeBorder: "#FDE8BF",
      statusText: "Filling (50–79%)",
      level: "warning",
    };
  }
  return {
    barColor: "#14532D",
    textColor: "#14532D",
    badgeBg: "#E9F4EC",
    badgeText: "#14532D",
    badgeBorder: "#CDE4D4",
    statusText: "Healthy (<50%)",
    level: "normal",
  };
}

interface SpringFillBarProps {
  fillPct: number | null | undefined;
  hasSensorError?: boolean;
  heightClassName?: string;
}

export function SpringFillBar({
  fillPct,
  hasSensorError = false,
  heightClassName = "h-2.5",
}: SpringFillBarProps) {
  const isOffline =
    hasSensorError ||
    fillPct === null ||
    fillPct === undefined ||
    Number.isNaN(fillPct);
  const clamped = isOffline ? 0 : Math.min(100, Math.max(0, fillPct));
  const style = getFillThresholdStyle(fillPct, hasSensorError);

  const springStyle = useSpring({
    width: isOffline ? "0%" : `${clamped}%`,
    backgroundColor: style.barColor,
    config: { tension: 170, friction: 24 },
  });

  return (
    <div
      className={`w-full ${heightClassName} rounded-full overflow-hidden ${
        isOffline
          ? "bg-[#EFF2EF] border border-dashed border-[#CFD8D0]"
          : "bg-[#EDF2EE]"
      }`}
    >
      {!isOffline && (
        <animated.div
          style={springStyle}
          className="h-full rounded-full"
        />
      )}
    </div>
  );
}

interface SpringPercentageTextProps {
  value: number | null | undefined;
  hasSensorError?: boolean;
  className?: string;
}

export function SpringPercentageText({
  value,
  hasSensorError = false,
  className = "",
}: SpringPercentageTextProps) {
  const isOffline =
    hasSensorError ||
    value === null ||
    value === undefined ||
    Number.isNaN(value);
  const clamped = isOffline ? 0 : Math.min(100, Math.max(0, value));

  const spring = useSpring({
    number: clamped,
    config: { tension: 160, friction: 22 },
  });

  if (isOffline) {
    return <span className={className}>N/A</span>;
  }

  return (
    <animated.span className={className}>
      {spring.number.to((n) => `${Math.round(n)}%`)}
    </animated.span>
  );
}
