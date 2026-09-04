"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useAuth } from "@/components/auth-provider";
import { useIsMobile } from "@/hooks/use-mobile";

// Account is now a sidebar, but OAuth returns here before continuing.
// Wait for the auth session to resolve so we don't redirect before Supabase
// has finished the OAuth code exchange (which would leave guards mid-race).
export default function AccountPage() {
  const router = useRouter();
  const { loading } = useAuth();
  const isMobile = useIsMobile();
  const t = useTranslations("accountPage");

  useEffect(() => {
    if (loading) return;

    const params = new URLSearchParams(window.location.search);
    const rawRedirect = params.get("redirect");
    const safeRedirect =
      rawRedirect?.startsWith("/") && !rawRedirect.startsWith("//")
        ? rawRedirect
        : isMobile
          ? "/watchlist"
          : "/explore";

    router.replace(safeRedirect);
  }, [router, loading, isMobile]);

  return (
    <div className="flex items-center justify-center py-16">
      <p className="text-sm text-muted-foreground">{t("redirecting")}</p>
    </div>
  );
}
