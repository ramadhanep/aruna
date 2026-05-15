"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Star, AlignHorizontalDistributeCenter, ChartPie, LayoutGrid, Ghost } from "lucide-react";
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
  const [scrollProgress, setScrollProgress] = useState(0);
  const [lastScrollY, setLastScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const scrollDelta = currentScrollY - lastScrollY;
      
      // Responsively update progress berdasarkan arah scroll
      setScrollProgress((prev) => {
        let newProgress = prev;
        
        if (scrollDelta > 0) {
          // Scroll DOWN - increment progress (shrink)
          newProgress = Math.min(prev + scrollDelta * 0.0015, 1);
        } else if (scrollDelta < 0) {
          // Scroll UP - decrement progress (expand) - lebih aggressive
          newProgress = Math.max(prev + scrollDelta * 0.003, 0);
        }
        
        return newProgress;
      });
      
      setLastScrollY(currentScrollY);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [lastScrollY]);

  // Scale dari 1 (normal) hingga 0.7 (kecil)
  const scale = 1 - scrollProgress * 0.3;
  const opacity = 0.95 + scrollProgress * 0.05;

  return (
    <nav 
      className="fixed bottom-5 left-5 right-5 z-50 liquid-glass pb-safe rounded-full transition-transform duration-500 ease-out"
      style={{
        transform: `scale(${scale})`,
        transformOrigin: "center bottom",
        opacity: opacity,
      }}
    >
      <div className="mx-auto max-w-[768px] flex items-center justify-around h-16">
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
                "relative flex flex-col items-center justify-center gap-1 flex-1 h-full transition-all duration-200",
                isActive
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {/* {isActive && (
                <span className="absolute top-1.5 w-5 h-0.5 rounded-full bg-emerald-500 dark:bg-emerald-400" />
              )} */}
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
