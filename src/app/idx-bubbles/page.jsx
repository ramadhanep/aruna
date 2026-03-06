"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { MarketBubbles } from "@/components/market-bubbles";

export default function IdxBubblesPage() {
  // Hide mobile bottom nav and header on mount
  useEffect(() => {
    document.body.style.overflow = "hidden";
    const header = document.querySelector("header");
    const nav = document.querySelector("nav");
    const bottomNav = document.querySelector(".mobile-bottom-nav");

    if (header) header.style.display = "none";
    if (nav) nav.style.display = "none";
    if (bottomNav) bottomNav.style.display = "none";

    return () => {
      document.body.style.overflow = "";
      if (header) header.style.display = "";
      if (nav) nav.style.display = "";
      if (bottomNav) bottomNav.style.display = "";
    };
  }, []);

  return (
    <div className="fixed inset-0 w-screen h-screen overflow-hidden">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between px-3 py-2 sm:px-4 sm:py-3 gap-2">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <div className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
            <ArrowLeft className="size-6 text-muted-foreground" />
          </div>
        </Link>
        <div className="flex-1 text-center">
          <h1 className="text-sm font-semibold text-white/80">Market Bubbles</h1>
          <p className="text-[10px] text-white/40">IDX Market Cap Visualization</p>
        </div>
        <div className="w-9" />
      </div>
      <MarketBubbles fullScreen />
    </div>
  );
}
