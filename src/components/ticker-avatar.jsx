"use client";

/* eslint-disable @next/next/no-img-element */

import { useState } from "react";
import { useAppearanceMode } from "@/components/appearance-mode-provider";

export function TickerAvatar({
  symbol,
  logo,
  size = "default", // "xs" | "sm" | "default"
  sizeClass = size === "xs" ? "h-5 w-5" : size === "sm" ? "h-6 w-6" : "h-8 w-8",
  textClass = size === "xs" ? "text-[8px]" : size === "sm" ? "text-[10px]" : "text-1xs",
  className = "",
  backgroundClass = "bg-muted/30",
}) {
  const { isLiteMode } = useAppearanceMode();
  const [failed, setFailed] = useState(false);
  const fallbackChar = symbol
    ? symbol.match(/[A-Za-z]/)?.[0]?.toUpperCase() ?? "O"
    : "O";
  const showImage = Boolean(logo) && !failed && !isLiteMode;

  return (
    <div
      className={`relative flex items-center justify-center rounded-2xl overflow-hidden ring-1 ring-border/50 ${backgroundClass} ${sizeClass} ${className}`.trim()}
    >
      {showImage ? (
        <>
          <img
            src={logo}
            alt={`${symbol} logo`}
            onError={() => setFailed(true)}
            className="
              h-full w-full object-cover
              contrast-110
              brightness-95
            "
          />
          {/* subtle overlay for UI harmony */}
          <div className="pointer-events-none absolute inset-0 bg-background/5" />
        </>
      ) : (
        <span
          className={`font-bold uppercase text-muted-foreground/80 ${textClass}`}
        >
          {fallbackChar}
        </span>
      )}
    </div>
  );
}
