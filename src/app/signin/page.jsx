"use client";

import { Suspense, useEffect } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useAuth } from "@/components/auth-provider";
import { EmailPasswordForm } from "@/components/email-password-form";
import { Skeleton } from "@/components/ui/skeleton";
import { ShieldAlert } from "lucide-react";

function SignInContent() {
  const t = useTranslations("signin");
  const { supabaseConfigured, user, loading } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const rawRedirect = searchParams?.get("redirect") || "/";
  const redirectTarget = rawRedirect.startsWith("/") ? rawRedirect : "/";
  const isRecovery = searchParams?.get("recovery") === "1";

  useEffect(() => {
    if (!loading && user && !isRecovery) {
      router.replace(redirectTarget);
    }
  }, [loading, user, redirectTarget, router, isRecovery]);

  return (
    <div className="flex min-h-[calc(100vh-10rem)] flex-col justify-center gap-6 items-center">
      <div className="flex items-center gap-2.5">
        <Image src="/aruna.png" alt="aruna" width={28} height={28} className="size-7" />
        <span className="text-lg font-bold tracking-tight">aruna</span>
      </div>
      <section className="w-full max-w-md rounded-lg border border-border bg-card px-6 py-7 text-foreground">
        <p className="text-1xs uppercase tracking-widest text-muted-foreground font-semibold">{t("welcomeBack")}</p>
        <h1 className="mt-1.5 text-base font-bold">{t("signInToContinue")}</h1>
        <div className="mt-6 space-y-3">
          <EmailPasswordForm />
          {!supabaseConfigured ? (
            <div className="flex items-start gap-2 rounded-2xl bg-amber-500/10 px-3 py-2.5 text-1xs text-amber-800 dark:text-amber-200">
              <ShieldAlert className="h-4 w-4 flex-shrink-0" />
              {t("providerWarning")}
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[calc(100vh-10rem)] flex-col justify-center items-center">
          <div className="skeleton-stagger w-full max-w-md rounded-lg border border-border bg-card px-6 py-7 space-y-3">
            <Skeleton className="h-3 w-24 rounded-full" />
            <Skeleton className="h-5 w-44 rounded-full" />
            <Skeleton className="h-3 w-64 rounded-full" />
            <Skeleton className="h-11 w-full rounded-full mt-4" />
          </div>
        </div>
      }
    >
      <SignInContent />
    </Suspense>
  );
}