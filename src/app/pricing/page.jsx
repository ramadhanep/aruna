"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GoogleGlyph } from "@/components/google-glyph";
import { useAuth } from "@/components/auth-provider";
import { useTrial } from "@/components/trial-provider";

const BENEFITS = [
  "IDX, US equities & crypto data",
  "Stock screener & momentum tools",
  "Money flow analysis",
  "Real-time market data",
];

export default function PricingPage() {
  const router = useRouter();
  const { signInWithGoogle, supabaseConfigured, user } = useAuth();
  const { restartTrial } = useTrial();
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [showRestartConfirm, setShowRestartConfirm] = useState(false);

  const handleGoogleSignIn = useCallback(async () => {
    if (!supabaseConfigured) {
      setAuthError("Sign-in is not available in this environment.");
      return;
    }
    setAuthLoading(true);
    setAuthError(null);
    try {
      await signInWithGoogle("/explore");
    } catch (err) {
      console.error("Sign-in failed", err);
      setAuthError("Unable to start sign-in. Please try again.");
      setAuthLoading(false);
    }
  }, [signInWithGoogle, supabaseConfigured]);

  const handleRestartTrial = useCallback(() => {
    restartTrial();
    router.push("/explore");
  }, [restartTrial, router]);

  // If already signed in, redirect them back to the app
  if (user) {
    return (
      <div className="mx-auto flex min-h-[80vh] w-full max-w-lg flex-col items-center justify-center px-4 py-16 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15">
          <Check className="h-7 w-7 text-emerald-500" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">You&apos;re signed in</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          You have an active account. Continue exploring Aruna.
        </p>
        <Button
          onClick={() => router.push("/explore")}
          className="mt-8 rounded-full bg-foreground px-8 text-background hover:bg-foreground/90"
        >
          Continue Exploring
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-16 sm:px-6 lg:px-8">

      {/* ── Hero ── */}
      <div className="text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          Continue Exploring Aruna
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-muted-foreground">
          Sign in with Google to keep using Aruna. Free, no payment needed.
        </p>
      </div>

      {/* ── Sign In Card ── */}
      <div className="mt-8 rounded-3xl border border-border/40 bg-card shadow-[0_16px_48px_rgba(0,0,0,0.12)] overflow-hidden">
        {/* Benefits */}
        <ul className="px-8 py-6 space-y-3">
          {BENEFITS.map((benefit) => (
            <li key={benefit} className="flex items-center gap-3 text-sm text-foreground/90">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-foreground/10">
                <Check className="h-3 w-3 text-foreground" />
              </span>
              {benefit}
            </li>
          ))}
        </ul>

        {/* CTA */}
        <div className="px-8 space-y-3">
          <Button
            id="google-signin-btn"
            type="button"
            onClick={handleGoogleSignIn}
            disabled={authLoading || !supabaseConfigured}
            className="w-full justify-center gap-3 rounded-full bg-foreground py-5 text-sm font-semibold text-background hover:bg-foreground/90 transition-all duration-200 disabled:opacity-50"
          >
            {authLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Connecting…
              </>
            ) : (
              <>
                <GoogleGlyph />
                Sign in with Google
              </>
            )}
          </Button>

          {authError && (
            <p className="text-center text-1xs text-red-500">{authError}</p>
          )}

          {!supabaseConfigured && (
            <p className="text-center text-1xs text-muted-foreground/70">
              Authentication is not configured in this environment.
            </p>
          )}
        </div>

        {/* ── Restart Trial ── */}
        <div className="border-t border-border/20 px-8 py-4">
          {!showRestartConfirm ? (
            <button
              type="button"
              onClick={() => setShowRestartConfirm(true)}
              className="flex w-full items-center justify-center gap-2 text-[12px] text-muted-foreground/70 hover:text-muted-foreground transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Try 1-hour guest mode again
            </button>
          ) : (
            <div className="text-center space-y-3">
              <p className="text-xs text-muted-foreground">
                Get another 1 hour of guest access to explore Aruna.
              </p>
              <div className="flex gap-2 justify-center">
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full text-xs"
                  onClick={() => setShowRestartConfirm(false)}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="rounded-full text-xs bg-foreground text-background hover:bg-foreground/90"
                  onClick={handleRestartTrial}
                >
                  Restart Trial
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
