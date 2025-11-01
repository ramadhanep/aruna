"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, RefreshCcwDot, BriefcaseBusiness, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  {
    title: "Home",
    url: "/",
    icon: Home,
  },
  {
    title: "Election Cycle",
    url: "/election-cycle",
    icon: RefreshCcwDot,
  },
  {
    title: "Portfolio",
    url: "/portfolio-tracker",
    icon: BriefcaseBusiness,
  },
  {
    title: "Settings",
    url: "/settings",
    icon: Settings,
  },
];

export function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border pb-safe">
      <div className="mx-auto max-w-[768px] flex items-center justify-around h-16">
        {navItems.map((item) => {
          const isActive = pathname === item.url;
          const Icon = item.icon;
          
          return (
            <Link
              key={item.url}
              href={item.url}
              className={cn(
                "flex flex-col items-center justify-center gap-1 flex-1 h-full transition-colors",
                isActive 
                  ? "text-primary" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className={cn("h-5 w-5", isActive && "fill-current")} />
              <span className="text-[10px] font-medium">{item.title}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
