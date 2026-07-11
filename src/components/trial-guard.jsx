"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTrial } from "@/components/trial-provider";

const PROTECTED_PATHS = [
  "/portfolio-tracker",
  "/watchlist",
  "/discussion",
  "/account",
  "/tools",
];

const PUBLIC_PATHS = ["/", "/signin", "/offline", "/pricing"];

export function TrialGuard({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const { initialized, isGuest, isActive, isExpired } = useTrial();

  useEffect(() => {
    if (!initialized || !isGuest) return;

    const isPublicPath = PUBLIC_PATHS.includes(pathname) || pathname?.startsWith("/api/");
    const isProtectedPath = !isPublicPath && PROTECTED_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));

    if (isExpired && isProtectedPath) {
      router.replace("/pricing");
      return;
    }

    if (!isActive && !isPublicPath && pathname !== "/pricing") {
      router.replace("/pricing");
    }
  }, [initialized, isGuest, isActive, isExpired, pathname, router]);

  return <>{children}</>;
}
