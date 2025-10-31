"use client";

import React from "react";
import Link from "next/link";
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";

export default function SidebarLayout({ children }) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen bg-background">
        <Sidebar>
          <SidebarHeader>
            <div className="px-2 py-2 text-lg font-semibold">Election Cycle App</div>
            <SidebarTrigger />
          </SidebarHeader>

          <SidebarContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <Link href="/">Home</Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <Link href="/election-cycle">Election Cycle</Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarContent>

          <SidebarFooter>
            <div className="px-2 py-2 text-xs text-muted-foreground">
              Created by <a href="https://ramadhanep.com" target="_blank" rel="noopener noreferrer" className="underline">Dy.</a>
            </div>
          </SidebarFooter>
        </Sidebar>

        <SidebarInset>
          {children}
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
