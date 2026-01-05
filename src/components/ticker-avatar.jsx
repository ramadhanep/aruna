"use client";

/* eslint-disable @next/next/no-img-element */

import { useState } from "react";

export function TickerAvatar({
  symbol,
  logo,
  size = "default", // "sm" | "default"
  sizeClass = size === "sm" ? "h-6 w-6" : "h-7 w-7",
  textClass = size === "sm" ? "text-[10px]" : "text-[11px]",
  className = "",
  backgroundClass = "bg-muted/20",
}) {
  const [failed, setFailed] = useState(false);
  const fallbackChar = symbol ? symbol.charAt(0) : "?";
  const showImage = Boolean(logo) && !failed;

  return (
    <div
      className={`flex items-center justify-center rounded-full overflow-hidden ${backgroundClass} ${sizeClass} ${className}`.trim()}
    >
      {showImage ? (
        <img
          src={logo}
          alt={`${symbol} logo`}
          className="h-full w-full object-cover hue-rotate-200"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className={`font-semibold uppercase text-muted-foreground ${textClass}`}>
          {fallbackChar}
        </span>
      )}
    </div>
  );
}
