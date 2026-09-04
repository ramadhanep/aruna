"use client";

import { useEffect } from "react";
import dynamic from "next/dynamic";

const MarketBubbles = dynamic(() => import("@/components/market-bubbles").then(mod => mod.MarketBubbles), {
  ssr: false,
  loading: () => <div className="fixed inset-0 w-screen h-screen bg-background animate-pulse" />,
});

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
