"use client";

import { useMemo } from "react";
import { Clock3 } from "lucide-react";
import { useTrial } from "@/components/trial-provider";

function formatTime(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function TrialBanner() {
  const { initialized, isGuest, isActive, isExpired, remainingMs } = useTrial();

  const shouldShow = initialized && isGuest && isActive && !isExpired;
  const urgencyClass = useMemo(() => {
    if (remainingMs <= 60_000) return "text-white";
    if (remainingMs <= 3 * 60_000) return "text-white/90";
    return "text-white/90";
  }, [remainingMs]);

  if (!shouldShow) return null;

  return (
    <div className="pointer-events-none fixed left-1/2 bottom-3 z-[180] -translate-x-1/2 px-3 transition-opacity duration-300">
      <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-white/15 bg-[#DC2626] px-3 py-1.5 text-white shadow-[0_8px_24px_rgba(0,0,0,0.25)]">
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white/15">
          <Clock3 className="h-3.5 w-3.5" />
        </div>
        <div className="flex flex-col leading-none">
          <span className="text-[12px] font-medium text-white">Free Trial</span>
          <span className={`text-[11px] ${urgencyClass}`}>{formatTime(remainingMs)} remaining</span>
        </div>
      </div>
    </div>
  );
}
