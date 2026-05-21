"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Star, AlignHorizontalDistributeCenter, BriefcaseBusiness, LayoutDashboard, Telescope } from "lucide-react";
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
    icon: LayoutDashboard,
  },
  {
    title: "Tools",
    url: "/tools",
    icon: Telescope,
    matchPaths: ["/tools", ...TOOLS_ITEMS.map((item) => item.url)],
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
  const [clickedItem, setClickedItem] = useState(null);

  const handleNavItemClick = (url) => {
    setClickedItem(url);
    setTimeout(() => setClickedItem(null), 600);
  };

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
    <motion.nav 
      className="fixed bottom-5 left-5 right-5 z-50 liquid-glass p-1.5 rounded-full"
      style={{
        transformOrigin: "center bottom",
        willChange: "transform, opacity",
      }}
      animate={
        clickedItem
          ? {
              rotateZ: [0, 2, -2.5, 1.5, -1, 0],
              scaleY: [1, 0.98, 1.02, 0.99, 1.01, 1],
              scaleX: [1, 1.01, 0.99, 1.01, 0.99, 1],
            }
          : {
              scale: scale,
              opacity: opacity,
            }
      }
      transition={{
        duration: clickedItem ? 0.5 : 0.24,
        type: clickedItem ? "spring" : "easeInOut",
        stiffness: clickedItem ? 300 : undefined,
        damping: clickedItem ? 15 : undefined,
      }}
    >
      <motion.div
        className="mx-auto max-w-[768px] flex items-center justify-around"
        animate={
          clickedItem
            ? {
                rotateZ: [0, -1, 1.5, -0.8, 0.5, 0],
              }
            : {}
        }
        transition={{
          duration: 0.5,
          type: "spring",
          stiffness: 250,
          damping: 12
        }}
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
              onClick={() => handleNavItemClick(item.url)}
              className={cn(
                "relative flex flex-col items-center justify-center gap-0.5 transition-all duration-200 rounded-full select-none outline-none py-4 w-full",
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
                "h-5.5 w-5.5 transition-all duration-200",
                isActive && "scale-105 fill-current"
              )} />
            </Link>
          );
        })}
      </motion.div>
    </motion.nav>
  );
}
