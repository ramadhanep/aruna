"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { useIsMobile } from "@/hooks/use-mobile";

export default function LandingPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const isMobile = useIsMobile();

  useEffect(() => {
    if (loading) return;
    if (user) {
      router.replace(isMobile ? "/watchlist" : "/explore");
      return;
    }
    router.replace("/explore");
  }, [router, user, loading, isMobile]);

  return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}
