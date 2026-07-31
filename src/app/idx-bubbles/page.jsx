"use client";

import { useEffect } from "react";
import { MarketBubbles } from "@/components/market-bubbles";

export default function IdxBubblesPage() {
  // Lock scroll while fullscreen mode is active
  useEffect(() => {
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  return (
    <div className="fixed inset-0 w-screen h-screen overflow-hidden">
      <MarketBubbles fullScreen />
    </div>
  );
}
