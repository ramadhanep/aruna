"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Star, AlignHorizontalDistributeCenter, ChartPie, LayoutGrid, UserRound, ChevronDown, Workflow, Axe, Droplets, Rotate3D, Magnet, MessageCircleMore } from "lucide-react";
import { cn } from "@/lib/utils";
import { HeaderSymbolSearch } from "@/components/header-symbol-search";

const navItems = [
  {
    title: "Explore",
    url: "/",
    icon: LayoutGrid,
  },
  {
    title: "Supercharts",
    url: "/chart",
    icon: AlignHorizontalDistributeCenter,
  },
  {
    title: "Watchlist",
    url: "/watchlist",
    icon: Star,
  },
  {
    title: "Portfolio",
    url: "/portfolio-tracker",
    icon: ChartPie,
  },
];

const toolsItems = [
  { title: "Money Flow", url: "/money-flow", icon: Workflow, desc: "Track institutional flow" },
  { title: "Momentum", url: "/idx-momentum", icon: Axe, desc: "IDX momentum scanner" },
  { title: "Bubbles", url: "/idx-bubbles", icon: Droplets, desc: "Market bubble map" },
  { title: "Rotation", url: "/idx-rotation", icon: Rotate3D, desc: "Sector rotation view" },
  { title: "MSCI", url: "/msci", icon: Magnet, desc: "MSCI rebalance tracker" },
  { title: "Chat", url: "/discussion", icon: MessageCircleMore, desc: "Community discussion" },
];

export function DesktopNavbar({ onOpenAccountSidebar }) {
  const pathname = usePathname();
  const [toolsOpen, setToolsOpen] = useState(false);
  const toolsRef = useRef(null);
  const timeoutRef = useRef(null);

  const isToolsActive = toolsItems.some((item) => pathname === item.url);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const handleMouseEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setToolsOpen(true);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => setToolsOpen(false), 200);
  };

  return (
    <header className="hidden lg:flex items-center h-16 sticky top-0 z-40 bg-background/80 backdrop-blur-2xl border-b border-border/30">
      <div className="flex items-center w-full max-w-[1400px] mx-auto px-6 gap-1">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 mr-8 shrink-0">
          <img src="/aruna.png" alt="aruna" className="size-7" />
          <span className="text-lg font-bold tracking-tight">aruna</span>
        </Link>

        {/* Nav Items */}
        <nav className="flex items-center gap-0.5 flex-1">
          {navItems.map((item) => {
            const isActive = pathname === item.url;
            const Icon = item.icon;

            return (
              <Link
                key={item.url}
                href={item.url}
                className={cn(
                  "flex items-center gap-2 px-3.5 py-2 rounded-lg text-[13px] font-medium transition-all duration-150",
                  isActive
                    ? "bg-primary/10 text-primary font-semibold"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{item.title}</span>
              </Link>
            );
          })}

          {/* Tools Dropdown */}
          <div
            ref={toolsRef}
            className="relative"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            <button
              className={cn(
                "flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[13px] font-medium transition-all duration-150",
                isToolsActive
                  ? "bg-primary/10 text-primary font-semibold"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              )}
              onClick={() => setToolsOpen(!toolsOpen)}
            >
              <span>Tools</span>
              <ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-200", toolsOpen && "rotate-180")} />
            </button>

            {toolsOpen && (
              <div className="absolute top-full left-0 mt-1 w-64 rounded-xl border border-border/30 bg-background/95 backdrop-blur-2xl shadow-xl py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                {toolsItems.map((item) => {
                  const isActive = pathname === item.url;
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.url}
                      href={item.url}
                      onClick={() => setToolsOpen(false)}
                      className={cn(
                        "flex items-center gap-3 px-3.5 py-2.5 mx-1 rounded-lg text-[13px] transition-colors",
                        isActive
                          ? "bg-primary/10 text-primary font-semibold"
                          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <div>
                        <p className="font-medium text-foreground">{item.title}</p>
                        <p className="text-[11px] text-muted-foreground">{item.desc}</p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </nav>

        {/* Right Side */}
        <div className="flex items-center gap-2 ml-auto">
          <HeaderSymbolSearch />
          <button
            onClick={onOpenAccountSidebar}
            className="flex items-center justify-center h-8 w-8 rounded-full bg-muted/60 hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            aria-label="Profile"
          >
            <UserRound className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
