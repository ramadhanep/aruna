"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, LineChart, ShieldCheck, Sparkles, Wallet } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const LANDING_STARTED_KEY = "aruna_landing_started";

export default function LandingPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [clientReady, setClientReady] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);

  useEffect(() => {
    try {
      setHasStarted(localStorage.getItem(LANDING_STARTED_KEY) === "true");
    } catch {
      setHasStarted(false);
    } finally {
      setClientReady(true);
    }
  }, []);

  useEffect(() => {
    if (!clientReady || loading || !hasStarted) return;
    router.replace(user ? "/portfolio-tracker" : "/explore");
  }, [clientReady, loading, hasStarted, user, router]);

  const pricing = useMemo(
    () => [
      "Explore global and IDX market signal in one place",
      "Track watchlist and portfolio with synced account",
      "Use charting tools and trading context without paywall",
    ],
    []
  );

  const handleStart = () => {
    try {
      localStorage.setItem(LANDING_STARTED_KEY, "true");
    } catch {
      // ignore storage failures
    }
    router.push(user ? "/portfolio-tracker" : "/explore");
  };

  if (clientReady && hasStarted) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">Preparing your workspace...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-[radial-gradient(circle_at_10%_10%,rgba(16,185,129,.15),transparent_35%),radial-gradient(circle_at_90%_0%,rgba(59,130,246,.12),transparent_35%),linear-gradient(180deg,var(--background),color-mix(in_oklab,var(--background)_88%,black_12%))]">
      <section className="mx-auto max-w-7xl px-6 py-10 lg:px-12 lg:py-14">
        <div className="flex items-center justify-between rounded-2xl border border-border/50 bg-background/70 px-4 py-3 backdrop-blur md:px-5">
          <div className="flex items-center gap-2.5">
            <img src="/aruna.png" alt="aruna" className="size-7" />
            <span className="text-lg font-bold tracking-tight">aruna</span>
          </div>
          <Button variant="outline" className="rounded-full text-xs" onClick={() => router.push("/explore")}>
            Explore Market
          </Button>
        </div>

        <div className="mt-10 grid items-stretch gap-8 lg:grid-cols-2">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              <Sparkles className="h-3.5 w-3.5" />
              Built for modern investor workflow
            </div>
            <h1 className="text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
              Finance signal workspace that feels fast, clean, and practical.
            </h1>
            <p className="max-w-xl text-sm text-muted-foreground sm:text-base">
              Aruna combines explore feed, supercharts, watchlist, and portfolio tracker in one lightweight app so you can move from idea to decision faster.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button className="rounded-full px-6" onClick={handleStart}>
                Try it for free
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Button variant="outline" className="rounded-full px-6" asChild>
                <Link href="/signin">Sign in</Link>
              </Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Card className="border-border/50 bg-background/75">
                <CardContent className="p-4">
                  <LineChart className="h-4 w-4 text-emerald-500" />
                  <p className="mt-2 text-xs font-semibold">Market Signals</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">IDX, US, crypto, and thematic tools.</p>
                </CardContent>
              </Card>
              <Card className="border-border/50 bg-background/75">
                <CardContent className="p-4">
                  <Wallet className="h-4 w-4 text-blue-500" />
                  <p className="mt-2 text-xs font-semibold">Portfolio</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">Track digital assets and cash allocation.</p>
                </CardContent>
              </Card>
              <Card className="border-border/50 bg-background/75">
                <CardContent className="p-4">
                  <ShieldCheck className="h-4 w-4 text-violet-500" />
                  <p className="mt-2 text-xs font-semibold">Private by default</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">Your account, your data, your control.</p>
                </CardContent>
              </Card>
            </div>
          </div>

          <Card className="border-border/50 bg-background/80 p-1.5">
            <CardContent className="rounded-2xl border border-border/30 bg-muted/20 p-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pricing</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight">Free plan</h2>
              <p className="text-sm text-muted-foreground">Everything is currently free while we keep improving product quality.</p>
              <p className="mt-5 text-4xl font-bold">
                $0
                <span className="ml-1 text-sm font-medium text-muted-foreground">/month</span>
              </p>
              <div className="mt-5 space-y-2.5">
                {pricing.map((item) => (
                  <div key={item} className="flex items-start gap-2 text-sm">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-500" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
              <Button className="mt-6 w-full rounded-xl" onClick={handleStart}>
                Start now
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
