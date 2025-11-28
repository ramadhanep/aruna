"use client";

/* eslint-disable @next/next/no-img-element */

import { useState } from "react";

export function TickerAvatar({
  symbol,
  logo,
  sizeClass = "h-7 w-7",
  textClass = "text-[11px]",
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
          className="h-full w-full object-cover"
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
