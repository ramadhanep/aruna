"use client";

import * as React from "react";
import { Home, TrendingUp, ExternalLink, RefreshCcwDot, ChartCandlestick, BriefcaseBusiness } from "lucide-react";
import Link from "next/link";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { ModeToggle } from "@/components/mode-toggle";

// Menu items
const items = [
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
    title: "Magic Charts",
    url: "/magic-charts",
    icon: ChartCandlestick,
  },
  {
    title: "Portfolio Tracker",
    url: "/portfolio-tracker",
    icon: BriefcaseBusiness,
  },
];

export function AppSidebar({ ...props }) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  <TrendingUp className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">
                    Aruna
                  </span>
                  <span className="truncate text-xs">Market Analytics</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton asChild tooltip={item.title}>
                <Link href={item.url}>
                  <item.icon />
                  <span>{item.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="flex items-center justify-between px-2 py-1">
              <a
                href="https://ramadhanep.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <span>Created by Dy.</span>
                <ExternalLink className="h-3 w-3" />
              </a>
              <ModeToggle />
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
