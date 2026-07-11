"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Star, AlignHorizontalDistributeCenter, BriefcaseBusiness, LayoutDashboard, Telescope } from "lucide-react";
import { cn } from "@/lib/utils";
import { TOOLS_ITEMS } from "@/lib/tools-menu";

const navItems = [
  {
    title: "Watchlist",
    url: "/watchlist",
    icon: Star,
  },
  {
    title: "Supercharts",
    url: "/chart",
    icon: AlignHorizontalDistributeCenter,
  },
  {
    title: "Explore",
    url: "/explore",
    icon: LayoutDashboard,
  },
  {
    title: "Portfolio",
    url: "/portfolio-tracker",
    icon: BriefcaseBusiness,
  },
];

export function MobileBottomNav() {
  const pathname = usePathname();
  const [isMinimized, setIsMinimized] = useState(false);
  const lastScrollY = useRef(0);

  useEffect(() => {
    // Initialize lastScrollY to current scroll position on mount
    lastScrollY.current = window.scrollY;

    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const maxScrollY = document.documentElement.scrollHeight - window.innerHeight;

      // 1. Handle top bouncing & top area (always maximize)
      if (currentScrollY <= 10) {
        setIsMinimized(false);
        lastScrollY.current = Math.max(0, currentScrollY);
        return;
      }

      // 2. Handle bottom bouncing (ignore scroll events past the bottom limit)
      if (currentScrollY >= maxScrollY - 10) {
        return;
      }

      const scrollDelta = currentScrollY - lastScrollY.current;

      // 3. Update state only on significant direction changes (threshold of 5px)
      // This prevents micro-flickering and ensures ultra-responsive toggling
      if (scrollDelta > 5) {
        setIsMinimized(true);
      } else if (scrollDelta < -5) {
        setIsMinimized(false);
      }

      lastScrollY.current = currentScrollY;
    };

    // Use passive listener for butter-smooth scrolling performance (crucial for iOS)
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <nav
      className={cn("fixed bottom-3 left-1/2 -translate-x-1/2 z-50 border border-border bg-card p-1.5 rounded-full transition-all duration-200 w-[300px]", isMinimized && "translate-y-2 -translate-x-1/2 opacity-95")}
      style={{
        transformOrigin: "center bottom",
        willChange: "transform, opacity",
      }}
    >
      <div
        className="mx-auto flex items-center justify-around"
      >
        {navItems.map((item) => {
          const isActive = item.matchPaths
            ? item.matchPaths.some((path) => pathname === path)
            : pathname === item.url;
          const Icon = item.icon;

          return (
            <Link
              key={item.url}
              href={item.url}
              className={cn(
                "relative flex flex-col items-center justify-center transition-colors duration-200 rounded-full select-none outline-none py-3 w-full",
                isActive
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className={cn(
                "h-5 w-5 transition-transform duration-200",
                isActive && "scale-105"
              )} />
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
