"use client";

import React, { useState } from "react";
import { animated, useSpring } from "@react-spring/web";
import { CheckCircle2, AlertCircle, X } from "lucide-react";

interface SpringNumberProps {
  value: number;
  suffix?: string;
  decimals?: number;
  className?: string;
}

export function SpringNumber({
  value,
  suffix = "",
  decimals = 0,
  className = "",
}: SpringNumberProps) {
  const { number } = useSpring({
    number: Number.isFinite(value) ? value : 0,
    config: { tension: 180, friction: 24 },
  });

  return (
    <animated.span className={className}>
      {number.to((n) => `${n.toFixed(decimals)}${suffix}`)}
    </animated.span>
  );
}

interface SpringFillBarProps {
  value: number | null;
  barClassName: string;
  trackClassName?: string;
}

export function SpringFillBar({
  value,
  barClassName,
  trackClassName = "h-2.5 w-full overflow-hidden rounded-full bg-[#E1E8E1]",
}: SpringFillBarProps) {
  const clamped =
    value !== null && Number.isFinite(value)
      ? Math.max(0, Math.min(100, value))
      : 0;

  const styles = useSpring({
    width: `${clamped}%`,
    config: { tension: 210, friction: 26 },
  });

  return (
    <div className={trackClassName}>
      <animated.div
        className={`h-full rounded-full ${barClassName}`}
        style={styles}
      />
    </div>
  );
}

interface SpringCardProps {
  children: React.ReactNode;
  className?: string;
}

export function SpringCard({ children, className = "" }: SpringCardProps) {
  const [hovered, setHovered] = useState(false);
  const style = useSpring({
    transform: hovered ? "translateY(-2px)" : "translateY(0px)",
    boxShadow: hovered
      ? "0 10px 24px -10px rgba(23, 107, 69, 0.14)"
      : "0 1px 3px 0 rgba(16, 24, 20, 0.04)",
    config: { tension: 300, friction: 24 },
  });

  return (
    <animated.div
      style={style}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={className}
    >
      {children}
    </animated.div>
  );
}

interface SpringToastProps {
  message: string | null;
  variant?: "success" | "error";
  onDismiss: () => void;
}

export function SpringToast({
  message,
  variant = "success",
  onDismiss,
}: SpringToastProps) {
  const style = useSpring({
    opacity: message ? 1 : 0,
    transform: message ? "translateY(0px)" : "translateY(16px)",
    config: { tension: 260, friction: 22 },
  });

  if (!message) return null;

  return (
    <animated.div
      style={style}
      role="status"
      aria-live="polite"
      className={`fixed bottom-5 right-5 z-50 flex items-center gap-2.5 rounded-2xl border px-4 py-3 text-xs font-semibold shadow-lg ${
        variant === "success"
          ? "border-[#BBF7D0] bg-[#F0FDF4] text-[#166534]"
          : "border-[#FADAD7] bg-[#FFF0EE] text-[#C84F49]"
      }`}
    >
      {variant === "success" ? (
        <CheckCircle2 className="h-4 w-4 shrink-0 text-[#16A34A]" />
      ) : (
        <AlertCircle className="h-4 w-4 shrink-0 text-[#C84F49]" />
      )}
      <span>{message}</span>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss notification"
        className="ml-1 rounded-md p-1 hover:bg-black/5"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </animated.div>
  );
}
