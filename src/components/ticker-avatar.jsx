"use client";

/* eslint-disable @next/next/no-img-element */

import { useState } from "react";

export function TickerAvatar({
  symbol,
  logo,
  size = "default", // "xs" | "sm" | "default"
  sizeClass = size === "xs" ? "h-5 w-5" : size === "sm" ? "h-6 w-6" : "h-7 w-7",
  textClass = size === "xs" ? "text-[8px]" : size === "sm" ? "text-[10px]" : "text-[11px]",
  className = "",
  backgroundClass = "bg-muted/20",
}) {
  const [failed, setFailed] = useState(false);
  const fallbackChar = symbol ? symbol.charAt(0) : "?";
  const showImage = Boolean(logo) && !failed;

  return (
    <div
      className={`relative flex items-center justify-center rounded-full overflow-hidden ${backgroundClass} ${sizeClass} ${className}`.trim()}
    >
      {showImage ? (
        <>
          <img
            src={logo}
            alt={`${symbol} logo`}
            onError={() => setFailed(true)}
            className="
              h-full w-full object-cover
              contrast-125
              brightness-80
              saturate-200
            "
          />
          {/* overlay biar makin netral & nyatu sama UI */}
          <div className="pointer-events-none absolute inset-0 bg-background/10" />
        </>
      ) : (
        <span
          className={`font-semibold uppercase text-muted-foreground ${textClass}`}
        >
          {fallbackChar}
        </span>
      )}
    </div>
  );
}
