"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Star, AlignHorizontalDistributeCenter, ChartPie, LayoutGrid, Workflow, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { HeaderSymbolSearch } from "@/components/header-symbol-search";

const navItems = [
  {
    title: "Explore",
    url: "/explore",
    icon: LayoutGrid,
  },
  {
    title: "Flow",
    url: "/money-flow",
    icon: Workflow,
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

export function DesktopSidebar({ onOpenAccountSidebar }) {
  const pathname = usePathname();

  return (
    <aside className="hidden flex-col w-64 border-r border-border/30 h-screen fixed top-0 left-0 bg-background/50 backdrop-blur-xl z-40">
      <div className="flex h-14 items-center gap-3 px-4 border-b border-border/30">
        <div className="flex flex-1 items-center justify-center gap-2">
          <div className="h-4 relative overflow-hidden">
            <img src="/aruna.png" alt="aruna" className="size-5" />
          </div>
          <h1 className="text-lg font-bold tracking-tight">aruna</h1>
        </div>
        <HeaderSymbolSearch />
      </div>

      <nav className="mt-5 flex-1 px-3 space-y-1.5 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.url;
          const Icon = item.icon;

          return (
            <Link
              key={item.url}
              href={item.url}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group",
                isActive
                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-semibold"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground font-medium"
              )}
            >
              <Icon className={cn(
                "h-5 w-5 transition-transform duration-200",
                isActive && "scale-105"
              )} />
              <span className="text-sm">
                {item.title}
              </span>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-border/30">
        <button
          onClick={onOpenAccountSidebar}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl transition-all duration-200 text-muted-foreground hover:bg-muted/50 hover:text-foreground font-medium"
        >
          <UserRound className="h-5 w-5" />
          <span className="text-sm">Profile</span>
        </button>
      </div>
    </aside>
  );
}
