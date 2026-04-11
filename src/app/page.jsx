"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, LineChart, ShieldCheck, Sparkles, Wallet } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import MarketCanvas from "@/components/market-canvas";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const LANDING_STARTED_KEY = "aruna_landing_started";

export default function LandingPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const vantaContainerRef = useRef(null);
  const vantaInstanceRef = useRef(null);
  const [clientReady, setClientReady] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [vantaReady, setVantaReady] = useState(false);

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
    if (!clientReady) return;

    let cancelled = false;
    let cloudsScript;
    let threeScript;
    let createdCloudsScript = false;
    let createdThreeScript = false;

    const initVanta = () => {
      if (cancelled || !vantaContainerRef.current || vantaInstanceRef.current) return;
      if (!window.VANTA?.CLOUDS) return;

      vantaInstanceRef.current = window.VANTA.CLOUDS({
        el: vantaContainerRef.current,
        mouseControls: true,
        touchControls: true,
        gyroControls: false,
        minHeight: 200,
        minWidth: 200,

        skyColor: 0x0f172a,
        cloudColor: 0x38bdf8,
        cloudShadowColor: 0x020617,

        sunColor: 0x60a5fa,
        sunGlareColor: 0x93c5fd,
        sunlightColor: 0xbfdbfe,

        speed: 0.7,
      });
      setVantaReady(true);
    };

    const loadClouds = () => {
      if (window.VANTA?.CLOUDS) {
        initVanta();
        return;
      }

      cloudsScript = document.createElement("script");
      cloudsScript.src = "https://cdn.jsdelivr.net/npm/vanta@latest/dist/vanta.clouds.min.js";
      cloudsScript.async = true;
      cloudsScript.onload = initVanta;
      createdCloudsScript = true;
      document.body.appendChild(cloudsScript);
    };

    if (window.VANTA?.CLOUDS) {
      initVanta();
    } else if (window.THREE) {
      loadClouds();
    } else {
      threeScript = document.createElement("script");
      threeScript.src = "https://cdnjs.cloudflare.com/ajax/libs/three.js/r134/three.min.js";
      threeScript.async = true;
      threeScript.onload = loadClouds;
      createdThreeScript = true;
      document.body.appendChild(threeScript);
    }

    return () => {
      cancelled = true;
      if (vantaInstanceRef.current) {
        vantaInstanceRef.current.destroy();
        vantaInstanceRef.current = null;
      }
      if (createdCloudsScript && cloudsScript?.parentNode) cloudsScript.parentNode.removeChild(cloudsScript);
      if (createdThreeScript && threeScript?.parentNode) threeScript.parentNode.removeChild(threeScript);
    };
  }, [clientReady]);

  useEffect(() => {
    if (!clientReady || loading || !hasStarted) return;
    router.replace(user ? "/portfolio-tracker" : "/explore");
  }, [clientReady, loading, hasStarted, user, router]);

  const handleStart = () => {
    try {
      localStorage.setItem(LANDING_STARTED_KEY, "true");
    } catch {
      // ignore storage failures
    }
    router.push(user ? "/portfolio-tracker" : "/explore");
  };

  if (!clientReady || (hasStarted && loading)) {
    return (
      <div className="min-h-screen w-full bg-[#060b13] text-white">
        <div className="mx-auto flex min-h-screen max-w-7xl items-center justify-center px-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs text-white/90">
            <span className="size-1.5 rounded-full bg-emerald-300 animate-pulse" />
            Preparing your workspace...
          </div>
        </div>
      </div>
    );
  }

  if (hasStarted) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-[#060b13]">
        <div className="flex items-center gap-2 text-sm text-white/75">Preparing your workspace...</div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#060b13] text-white">
      <div ref={vantaContainerRef} className="absolute inset-0" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(37,99,235,.14),transparent_45%),radial-gradient(circle_at_80%_10%,rgba(16,185,129,.1),transparent_42%),linear-gradient(180deg,rgba(2,6,13,.62),rgba(2,6,13,.9))]" />

      <section className="relative z-10 mx-auto max-w-7xl px-6 py-10 lg:px-12 lg:py-14">
        <div className="flex items-center justify-between rounded-2xl border border-white/15 bg-[#081425]/60 px-4 py-3 backdrop-blur-xl md:px-5">
          <div className="flex items-center gap-2.5">
            <img src="/aruna.png" alt="aruna" className="size-7" />
            <span className="text-lg font-bold tracking-tight">aruna</span>
          </div>
          <Button variant="outline" className="rounded-full border-white/30 bg-transparent text-xs text-white hover:bg-white/10" onClick={() => router.push("/explore")}>
            Launch Console
          </Button>
        </div>

        <div className="mt-10 grid items-stretch gap-8 lg:grid-cols-2">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/35 bg-emerald-200/10 px-3 py-1 text-xs font-semibold text-emerald-200">
              <Sparkles className="h-3.5 w-3.5" />
              Built for modern investor workflow
            </div>
            <h1 className="text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
              A faster, cleaner way to read the financial market.
            </h1>
            <p className="max-w-xl text-sm text-white/75 sm:text-base">
              Aruna combines powerful market signals, advanced charting, and portfolio tracking into a seamless workspace designed for focused, decisive traders.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button className="rounded-full bg-emerald-500 px-6 text-emerald-950 hover:bg-emerald-400" onClick={handleStart}>
                Launch Console
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Card className="border-white/15 bg-[#0b1b2f]/75 backdrop-blur-xl">
                <CardContent className="p-4">
                  <LineChart className="h-4 w-4 text-emerald-300" />
                  <p className="mt-2 text-xs font-semibold">Market Signals</p>
                  <p className="mt-1 text-[11px] text-white/70">IDX, US stocks, crypto, and thematic tools.</p>
                </CardContent>
              </Card>
              <Card className="border-white/15 bg-[#0b1b2f]/75 backdrop-blur-xl">
                <CardContent className="p-4">
                  <Wallet className="h-4 w-4 text-sky-300" />
                  <p className="mt-2 text-xs font-semibold">Portfolio</p>
                  <p className="mt-1 text-[11px] text-white/70">Track digital assets and cash allocation.</p>
                </CardContent>
              </Card>
              <Card className="border-white/15 bg-[#0b1b2f]/75 backdrop-blur-xl">
                <CardContent className="p-4">
                  <ShieldCheck className="h-4 w-4 text-cyan-300" />
                  <p className="mt-2 text-xs font-semibold">Private by default</p>
                  <p className="mt-1 text-[11px] text-white/70">Your account, your data, your control.</p>
                </CardContent>
              </Card>
            </div>
            {!vantaReady ? (
              <p className="text-[11px] text-white/60">Loading interactive cloud background...</p>
            ) : null}
          </div>
          <div className="hidden lg:flex lg:items-center lg:pl-4">
            <MarketCanvas />
          </div>
        </div>
      </section>
    </div>
  );
}
