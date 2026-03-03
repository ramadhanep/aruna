"use client";

import { useState } from "react";
import { HeaderSymbolSearch } from "@/components/header-symbol-search";
import { HeaderAccountMenu } from "@/components/header-account-menu";
import { AccountSidebar } from "@/components/account-sidebar";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";
import { AlignEndHorizontal } from "lucide-react";

export function AppLayoutClient({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <>
      <AccountSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex flex-col min-h-screen">
        <header className="sticky top-0 z-40 liquid-glass">
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
        <main className="flex-1 pb-20">
          <div className="mx-auto max-w-[768px] p-4">
            {children}
          </div>
        </main>
        <MobileBottomNav />
      </div>
    </>
  );
}
