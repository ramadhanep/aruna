"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, ChevronDown, ChevronUp, Sparkles, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GoogleGlyph } from "@/components/google-glyph";
import { useAuth } from "@/components/auth-provider";
import { useTrial } from "@/components/trial-provider";

const EARLY_ACCESS_BENEFITS = [
  "1 year complimentary access",
  "Early adopter status",
  "Shape the future of Aruna",
  "Priority product updates",
  "Access to upcoming premium features",
];

const FUTURE_PLANS = [
  {
    name: "Monthly",
    price: "Rp29.000",
    period: "/ month",
    description: "Flexible access, cancel anytime.",
  },
  {
    name: "Yearly",
    price: "Rp229.000",
    period: "/ year",
    description: "Best value. Equivalent to ~2 months free.",
    highlight: true,
  },
];

export default function PricingPage() {
  const router = useRouter();
  const { signInWithGoogle, supabaseConfigured, user } = useAuth();
  const { restartTrial } = useTrial();
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [showPricing, setShowPricing] = useState(false);
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
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">You&apos;re already in</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          You have an active account. Enjoy full Early Access.
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
        <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
          Join Aruna<br className="hidden sm:block" /> Early Access
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-sm leading-7 text-muted-foreground">
          Your free trial has ended. But Aruna is still free&mdash;create a free account
          with Google to keep exploring. No payment required.
        </p>
      </div>

      {/* ── Founding Member Card ── */}
      <div className="mt-10 rounded-3xl border border-border/40 bg-card shadow-[0_16px_48px_rgba(0,0,0,0.12)] overflow-hidden">
        {/* Header stripe */}
        <div className="px-8 pt-8 pb-6 border-b border-border/30">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
            Founding Member
          </p>
          <p className="mt-1 text-xl font-semibold text-foreground">Register before public launch</p>
        </div>

        {/* Benefits */}
        <ul className="px-8 py-6 space-y-3">
          {EARLY_ACCESS_BENEFITS.map((benefit) => (
            <li key={benefit} className="flex items-center gap-3 text-sm text-foreground/90">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-foreground/10">
                <Check className="h-3 w-3 text-foreground" />
              </span>
              {benefit}
            </li>
          ))}
        </ul>

        {/* CTA */}
        <div className="px-8 pb-8 space-y-3">
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
                Claim Early Access with Google
              </>
            )}
          </Button>

          {authError && (
            <p className="text-center text-[11px] text-red-500">{authError}</p>
          )}

          {!supabaseConfigured && (
            <p className="text-center text-[11px] text-muted-foreground/70">
              Authentication is not configured in this environment.
            </p>
          )}

          <p className="text-center text-[11px] text-muted-foreground/60 leading-relaxed">
            Free during Early Access. Subscriptions begin after official launch.
            Early Access members receive one complimentary year.
          </p>
        </div>
      </div>

      {/* ── Future Pricing (collapsed by default) ── */}
      <div className="mt-6">
        <button
          type="button"
          onClick={() => setShowPricing((v) => !v)}
          className="flex w-full items-center justify-between gap-2 rounded-2xl border border-border/40 bg-card/60 px-5 py-4 text-left text-sm transition-colors hover:bg-card"
        >
          <div>
            <p className="font-medium text-foreground">Planned Subscription Pricing</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">Available after official launch</p>
          </div>
          {showPricing
            ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
            : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
          }
        </button>

        {showPricing && (
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            {FUTURE_PLANS.map((plan) => (
              <div
                key={plan.name}
                className={`rounded-2xl border px-5 py-5 ${plan.highlight
                  ? "border-border/60 bg-card"
                  : "border-border/30 bg-card/50"
                  }`}
              >
                {plan.highlight && (
                  <span className="mb-3 inline-block text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
                    Best Value
                  </span>
                )}
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{plan.name}</p>
                <div className="mt-1.5 flex items-end gap-1">
                  <span className="text-2xl font-semibold tracking-tight text-foreground">{plan.price}</span>
                  <span className="pb-0.5 text-xs text-muted-foreground">{plan.period}</span>
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">{plan.description}</p>
              </div>
            ))}
            <p className="sm:col-span-2 text-[11px] text-muted-foreground/70 text-center px-2">
              Subscriptions will begin after the official launch.
              Early Access members receive one year of complimentary access.
            </p>
          </div>
        )}
      </div>

      {/* ── Restart Trial (secondary) ── */}
      <div className="mt-4">
        {!showRestartConfirm ? (
          <button
            type="button"
            onClick={() => setShowRestartConfirm(true)}
            className="flex w-full items-center justify-center gap-2 py-3 text-[12px] text-muted-foreground/70 hover:text-muted-foreground transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Restart free trial instead
          </button>
        ) : (
          <div className="rounded-2xl border border-border/40 bg-card/60 px-5 py-4 text-center space-y-3">
            <p className="text-xs text-muted-foreground">
              This gives you another 10-minute trial. Creating an account is permanent and free.
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
  );
}
