"use client";

import { useState } from "react";
import { HeaderSymbolSearch } from "@/components/header-symbol-search";
import { HeaderAccountMenu } from "@/components/header-account-menu";
import { AccountSidebar } from "@/components/account-sidebar";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";
import { DesktopNavbar } from "@/components/desktop-navbar";


export function AppLayoutClient({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <>
      <AccountSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      <div className="flex flex-col min-h-screen relative w-full overflow-x-hidden">
        {/* Desktop Top Navbar (Hidden on mobile/tablet) */}
        <DesktopNavbar onOpenAccountSidebar={() => setSidebarOpen(true)} />
        
        {/* Mobile Header (Hidden on lg+) */}
        <header className="lg:hidden sticky top-0 z-40 liquid-glass shrink-0">
          <div className="mx-auto max-w-[768px] flex h-14 items-center justify-between gap-3 px-3">
            <HeaderAccountMenu onOpenSidebar={() => setSidebarOpen(true)} />
            <div className="flex flex-1 items-center justify-center gap-1.5">
              <img src="/aruna.png" alt="aruna" className="size-5" />
              <h1 className="text-lg font-bold tracking-tight">aruna</h1>
            </div>
            <HeaderSymbolSearch />
          </div>
        </header>
        
        <main className="flex-1 pb-24 lg:pb-8 relative z-0 w-full flex justify-center">
          <div className="p-4 w-full max-w-[768px] lg:max-w-[1400px] lg:px-6">
            {children}
          </div>
        </main>
        
        {/* Mobile Bottom Nav (Hidden on lg+) */}
        <div className="lg:hidden">
          <MobileBottomNav />
        </div>
      </div>
    </>
  );
}
