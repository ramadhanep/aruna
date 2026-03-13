"use client";

import { useState } from "react";
import { HeaderSymbolSearch } from "@/components/header-symbol-search";
import { HeaderAccountMenu } from "@/components/header-account-menu";
import { AccountSidebar } from "@/components/account-sidebar";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";
import { DesktopSidebar } from "@/components/desktop-sidebar";
import { AlignEndHorizontal } from "lucide-react";

export function AppLayoutClient({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <>
      <AccountSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      <div className="flex flex-col md:flex-row min-h-screen relative w-full overflow-x-hidden">
        {/* Desktop Sidebar */}
        <DesktopSidebar onOpenAccountSidebar={() => setSidebarOpen(true)} />
        
        {/* Main Content Area */}
        <div className="flex flex-col flex-1 min-w-0 w-full relative md:pl-64">
          
          {/* Mobile Header (Hidden on md+) */}
          <header className="md:hidden sticky top-0 z-40 liquid-glass shrink-0">
            <div className="mx-auto max-w-[768px] flex h-14 items-center justify-between gap-3 px-3">
              <HeaderAccountMenu onOpenSidebar={() => setSidebarOpen(true)} />
              <div className="flex flex-1 items-center justify-center gap-1.5">
                <div className="h-4 relative overflow-hidden">
                  <AlignEndHorizontal className="size-5" />
                </div>
                <h1 className="text-lg font-bold tracking-tight">aruna</h1>
              </div>
              <HeaderSymbolSearch />
            </div>
          </header>
          
          <main className="flex-1 pb-20 md:pb-6 relative z-0 w-full flex justify-center">
            {/* 
              In Mobile: mx-auto max-w-[768px] 
              In Desktop: w-full max-w-[1280px]
            */}
            <div className="p-4 w-full max-w-[768px] md:max-w-[1280px]">
              {children}
            </div>
          </main>
          
          {/* Mobile Bottom Nav (Hidden on md+) */}
          <div className="md:hidden">
            <MobileBottomNav />
          </div>
        </div>
      </div>
    </>
  );
}
