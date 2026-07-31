"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth-provider";
import { GoogleGlyph } from "@/components/google-glyph";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, ShieldAlert } from "lucide-react";

function SignInContent() {
  const { signInWithGoogle, supabaseConfigured, user, loading } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [error, setError] = useState(null);
  const [processing, setProcessing] = useState(false);
  const rawRedirect = searchParams?.get("redirect") || "/";
  const redirectTarget = rawRedirect.startsWith("/") ? rawRedirect : "/";

  useEffect(() => {
    if (!loading && user) {
      router.replace(redirectTarget);
    }
  }, [loading, user, redirectTarget, router]);

  const handleSignIn = async () => {
    setError(null);
    setProcessing(true);
    try {
      const returnPath = `/account?redirect=${encodeURIComponent(redirectTarget)}`;
      await signInWithGoogle(returnPath);
    } catch (err) {
      console.error("Failed to start Google sign-in", err);
      setError(
        supabaseConfigured
          ? "Unable to start Google sign-in. Please try again."
          : "Provider credentials are missing. Add them to enable sign-in."
      );
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-10rem)] flex-col justify-center gap-6 items-center">
      <section className="w-full max-w-md rounded-lg border border-border bg-card px-6 py-7 text-white">
        <p className="text-[11px] uppercase tracking-widest text-white/50 font-semibold">Welcome back</p>
        <h1 className="mt-1.5 text-base font-bold">Sign in to continue</h1>
        <p className="mt-2 text-[11px] text-white/70 leading-relaxed">
          Sync your watchlist and portfolio securely across every device.
        </p>
        <div className="mt-6 space-y-3">
          <Button
            type="button"
            onClick={handleSignIn}
            disabled={processing || !supabaseConfigured}
            className="w-full justify-center gap-3 rounded-full bg-foreground text-xs font-semibold text-background hover:bg-foreground/95 h-11"
          >
            {processing ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Redirecting…
              </span>
            ) : (
              <>
                <GoogleGlyph />
                <span>Sign in with Google</span>
              </>
            )}
          </Button>
          {error ? (
            <div className="rounded-2xl bg-red-500/15 px-3 py-2.5 text-[11px] text-red-200">
              {error}
            </div>
          ) : null}
          {!supabaseConfigured ? (
            <div className="flex items-start gap-2 rounded-2xl bg-amber-500/10 px-3 py-2.5 text-[11px] text-amber-200">
              <ShieldAlert className="h-4 w-4 flex-shrink-0" />
              Provider credentials are not configured. Remote sync will be disabled until you add them.
            </div>
          ) : null}
          <p className="text-[11px] text-white/50 leading-relaxed">
            By continuing you agree to our use of Google for authentication. We only use your email to keep your data in sync.
          </p>
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
          <div className="w-full max-w-md rounded-lg border border-border bg-card px-6 py-7 space-y-3">
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
