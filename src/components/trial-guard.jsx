"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTrial } from "@/components/trial-provider";
import { useAuth } from "@/components/auth-provider";

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
  const { initialized, isGuest, isTrialActive } = useTrial();
  const { loading: authLoading } = useAuth();

  useEffect(() => {
    if (!initialized || !isGuest || authLoading) return;

    const isPublicPath = PUBLIC_PATHS.includes(pathname) || pathname?.startsWith("/api/");
    const isProtectedPath = !isPublicPath && PROTECTED_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));

    const active = isTrialActive();

    if (!active && isProtectedPath) {
      router.replace("/pricing");
      return;
    }

    if (!active && !isPublicPath && pathname !== "/pricing") {
      router.replace("/pricing");
    }
  }, [initialized, isGuest, isTrialActive, pathname, router, authLoading]);

  return <>{children}</>;
}
