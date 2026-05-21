"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const getSafeRedirect = () => {
  if (typeof window === "undefined") return "/portfolio-tracker";

  const params = new URLSearchParams(window.location.search);
  const redirect = params.get("redirect") || "/portfolio-tracker";

  return redirect.startsWith("/") && !redirect.startsWith("//")
    ? redirect
    : "/portfolio-tracker";
};

// Account is now a sidebar, but OAuth returns here before continuing.
export default function AccountPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace(getSafeRedirect());
  }, [router]);

  return (
    <div className="flex items-center justify-center py-16">
      <p className="text-sm text-muted-foreground">Redirecting...</p>
    </div>
  );
}
