"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { HeaderSymbolSearch } from "@/components/header-symbol-search";
import { HeaderAccountMenu } from "@/components/header-account-menu";
import { AccountSidebar } from "@/components/account-sidebar";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";
import { DesktopNavbar } from "@/components/desktop-navbar";


export function AppLayoutClient({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const isLandingPage = pathname === "/";

  const mobileBackHeaderRoutes = {
    "/idx-momentum": "IDX Momentum",
    "/msci": "MSCI Tracker",
  };

  const hideDefaultMobileChromeRoutes = new Set([
    "/",
    "/idx-bubbles",
    "/idx-momentum",
    "/idx-rotation",
    "/msci",
    "/discussion",
  ]);
  const hideDesktopNavbarRoutes = new Set([
    "/",
    "/idx-bubbles",
    "/idx-rotation",
    "/discussion",
  ]);

  const needsBackHeader = Boolean(mobileBackHeaderRoutes[pathname]);
  const hideDefaultMobileChrome = hideDefaultMobileChromeRoutes.has(pathname);
  const hideDesktopNavbar = hideDesktopNavbarRoutes.has(pathname);

  return (
    <>
      <AccountSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      <div className="flex flex-col min-h-screen relative w-full overflow-x-hidden">
        {/* Desktop Top Navbar (Hidden on mobile/tablet) */}
        {!hideDesktopNavbar && <DesktopNavbar onOpenAccountSidebar={() => setSidebarOpen(true)} />}
        
        {/* Mobile Header (Hidden on lg+) */}
        {!hideDefaultMobileChrome && (
          <header className="lg:hidden sticky top-0 z-40 shrink-0">
            <div className="mx-auto max-w-[768px] flex h-14 items-center justify-between gap-3 px-3">
              <HeaderAccountMenu onOpenSidebar={() => setSidebarOpen(true)} />
              <div className="flex flex-1 items-center justify-center gap-1.5">
                <img src="/aruna.png" alt="aruna" className="size-5" />
                <h1 className="text-lg font-bold tracking-tight">aruna</h1>
              </div>
              <HeaderSymbolSearch />
            </div>
          </header>
        )}

        {needsBackHeader && (
          <header className="lg:hidden sticky top-0 z-40 shrink-0 border-b border-border/30">
            <div className="mx-auto max-w-[768px] flex h-14 items-center justify-between px-3">
              <button
                type="button"
                onClick={() => router.back()}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.06] hover:bg-white/[0.12] transition-colors"
                aria-label="Go back"
              >
                <ArrowLeft className="h-4 w-4 text-muted-foreground" />
              </button>
              <h1 className="text-sm font-semibold tracking-tight">{mobileBackHeaderRoutes[pathname]}</h1>
              <div className="h-9 w-9" />
            </div>
          </header>
        )}
        
        <main className={`flex-1 ${hideDefaultMobileChrome ? "pb-0" : "pb-24"} lg:pb-8 relative z-0 w-full ${isLandingPage ? "" : "flex justify-center"}`}>
          <div className={isLandingPage ? "w-full" : "p-4 w-full max-w-[768px] lg:max-w-[1400px] lg:px-6"}>
            {children}
          </div>
        </main>
        
        {/* Mobile Bottom Nav (Hidden on lg+) */}
        {!hideDefaultMobileChrome && (
          <div className="lg:hidden">
            <MobileBottomNav />
          </div>
        )}
      </div>
    </>
  );
}
