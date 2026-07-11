"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import { HeaderSymbolSearch } from "@/components/header-symbol-search";
import { HeaderAccountMenu } from "@/components/header-account-menu";
import { AccountSidebar } from "@/components/account-sidebar";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";
import { DesktopNavbar } from "@/components/desktop-navbar";
import { useAuth } from "@/components/auth-provider";
import { useTrial } from "@/components/trial-provider";

const PUBLIC_ROUTES = new Set(["/", "/signin", "/offline", "/pricing", "/explore"]);

export function AppLayoutClient({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useAuth();
  const { initialized, isActive, isExpired } = useTrial();
  const isLandingPage = pathname === "/";
  const isPublicRoute = PUBLIC_ROUTES.has(pathname);
  const isProtectedRoute = !isPublicRoute;
  const canAccessWithoutAuth = Boolean(user) || (initialized && isActive) || isPublicRoute;
  const shouldBlockProtectedContent = isProtectedRoute && !canAccessWithoutAuth && (loading || !user);

  useEffect(() => {
    if (!isProtectedRoute || loading || user || (initialized && isActive)) return;

    const currentPath =
      typeof window !== "undefined"
        ? `${window.location.pathname}${window.location.search}`
        : pathname || "/";
    const redirectPath = currentPath.startsWith("/") ? currentPath : "/";

    if (initialized && isExpired) {
      router.replace("/pricing");
      return;
    }

    router.replace(`/signin?redirect=${encodeURIComponent(redirectPath)}`);
  }, [isProtectedRoute, loading, pathname, router, user, initialized, isActive, isExpired]);

  const mobileBackHeaderRoutes = {
    "/idx-momentum": "IDX Momentum",
    "/msci": "MSCI Tracker",
  };

  const hideDefaultMobileChromeRoutes = new Set([
    "/",
    "/signin",
    "/idx-bubbles",
    "/idx-momentum",
    "/idx-rotation",
    "/msci",
    "/discussion",
  ]);
  const hideDesktopNavbarRoutes = new Set([
    "/",
    "/signin",
    "/idx-bubbles",
    "/idx-rotation",
    "/discussion",
  ]);

  const needsBackHeader = Boolean(mobileBackHeaderRoutes[pathname]);
  const hideDefaultMobileChrome = hideDefaultMobileChromeRoutes.has(pathname);
  const hideDesktopNavbar = hideDesktopNavbarRoutes.has(pathname);
  const mainContent = shouldBlockProtectedContent ? (
    <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
        <p className="text-xs font-semibold uppercase tracking-widest">
          Checking access
        </p>
      </div>
    </div>
  ) : (
    children
  );

  return (
    <>
      {!isPublicRoute && !shouldBlockProtectedContent && (
        <AccountSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      )}
      
      <div className="flex flex-col min-h-screen relative w-full overflow-x-hidden">
        {/* Desktop Top Navbar (Hidden on mobile/tablet) */}
        {!hideDesktopNavbar && !shouldBlockProtectedContent && (
          <DesktopNavbar onOpenAccountSidebar={() => setSidebarOpen(true)} />
        )}
        
        {/* Mobile Header (Hidden on lg+) */}
        {!hideDefaultMobileChrome && !shouldBlockProtectedContent && (
          <header className="lg:hidden sticky top-0 z-40 shrink-0 border-b border-border bg-black">
            <div className="mx-auto max-w-[768px] flex h-14 items-center justify-between gap-3 px-4">
              <HeaderAccountMenu onOpenSidebar={() => setSidebarOpen(true)} />
              <div className="flex flex-1 items-center justify-center gap-1.5">
                <img src="/aruna.png" alt="aruna" className="size-5" />
                <h1 className="text-lg font-bold tracking-tight">aruna</h1>
              </div>
              <HeaderSymbolSearch />
            </div>
          </header>
        )}

        {needsBackHeader && !shouldBlockProtectedContent && (
          <header className="lg:hidden sticky top-0 z-40 shrink-0 border-b border-border bg-black">
            <div className="mx-auto max-w-[768px] flex h-14 items-center justify-between px-3">
              <button
                type="button"
                onClick={() => router.back()}
                className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-[#111] hover:bg-[#171717] transition-colors"
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
            {mainContent}
          </div>
        </main>
        
        {/* Mobile Bottom Nav (Hidden on lg+) */}
        {!hideDefaultMobileChrome && !shouldBlockProtectedContent && (
          <div className="lg:hidden">
            <MobileBottomNav />
          </div>
        )}
      </div>
    </>
  );
}
