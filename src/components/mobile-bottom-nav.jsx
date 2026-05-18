"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Star, AlignHorizontalDistributeCenter, ChartPie, LayoutGrid, Ghost } from "lucide-react";
import { motion } from "framer-motion";
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
    icon: LayoutGrid,
  },
  {
    title: "Tools",
    url: "/tools",
    icon: Ghost,
    matchPaths: ["/tools", ...TOOLS_ITEMS.map((item) => item.url)],
  },
  {
    title: "Portfolio",
    url: "/portfolio-tracker",
    icon: ChartPie,
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

  // Fixed scale values: 1.0 (normal) and 0.8 (minimized)
  const scale = isMinimized ? 0.8 : 1;
  const opacity = isMinimized ? 0.96 : 1;

  return (
    <nav 
      className="fixed bottom-5 left-5 right-5 z-50 liquid-glass pb-safe rounded-full"
      style={{
        transform: `scale(${scale})`,
        transformOrigin: "center bottom",
        opacity: opacity,
        transition: "transform 0.24s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.24s cubic-bezier(0.16, 1, 0.3, 1)",
        willChange: "transform, opacity",
      }}
    >
      <div className="mx-auto max-w-[768px] flex items-center justify-around h-16 px-2">
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
                "relative flex flex-col items-center justify-center gap-0.5 flex-1 h-[80%] transition-all duration-200 rounded-full select-none outline-none",
                isActive
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {isActive && (
                <motion.div
                  layoutId="active-nav-bubble"
                  className="absolute inset-0 rounded-full bg-black/[0.08] dark:bg-white/[0.08] border border-black/[0.04] dark:border-white/[0.04] shadow-[inset_0_1px_2px_rgba(255,255,255,0.15)] -z-10"
                  transition={{
                    type: "spring",
                    stiffness: 380,
                    damping: 30
                  }}
                />
              )}
              <Icon className={cn(
                "h-5 w-5 transition-transform duration-200",
                isActive && "scale-105"
              )} />
              <span className={cn(
                "text-[10px] transition-all",
                isActive ? "font-semibold" : "font-medium"
              )}>
                {item.title}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
