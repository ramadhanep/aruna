"use client";

import { useEffect } from "react";
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
      <MarketBubbles fullScreen />
    </div>
  );
}
