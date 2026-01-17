"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Account is now a sidebar, redirect to home
export default function AccountPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/");
  }, [router]);

  return (
    <div className="flex items-center justify-center py-16">
      <p className="text-sm text-muted-foreground">Redirecting...</p>
    </div>
  );
}
