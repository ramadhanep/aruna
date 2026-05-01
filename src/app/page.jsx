"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { 
  ArrowRight, 
  BarChart3, 
  Database, 
  Globe2, 
  Network, 
  PieChart, 
  Lock, 
  Sparkles
} from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";

const LANDING_STARTED_KEY = "aruna_landing_started";

// --- Fake Data ---
const sparklineData = Array.from({ length: 30 }, (_, i) => ({
  time: i,
  price: 9000 + Math.sin(i * 0.4) * 150 + i * 40 + Math.random() * 80,
}));

const tickerData = [
  { symbol: "BBCA", change: "+1.2%", up: true },
  { symbol: "TLKM", change: "-0.4%", up: false },
  { symbol: "GOTO", change: "+3.1%", up: true },
  { symbol: "BMRI", change: "+0.8%", up: true },
  { symbol: "AMMN", change: "-1.5%", up: false },
  { symbol: "BREN", change: "+4.2%", up: true },
  { symbol: "AAPL", change: "+0.8%", up: true },
  { symbol: "NVDA", change: "+2.1%", up: true },
  { symbol: "BTC-USD", change: "+2.4%", up: true },
  { symbol: "ETH-USD", change: "-0.2%", up: false },
];

const features = [
  { name: "Seasonal Charts", desc: "Overlay historical patterns with election-cycle context.", icon: BarChart3 },
  { name: "Institutional Money Flow", desc: "Track smart money via Stockbit broker data.", icon: Database },
  { name: "MSCI Tracker", desc: "Monitor IDX stocks approaching MSCI inclusion.", icon: Globe2 },
  { name: "RRG Analysis", desc: "Relative Rotation Graph for sector momentum.", icon: Network },
  { name: "Market Bubbles", desc: "Visual market cap map for IDX sectors.", icon: PieChart },
  { name: "Watchlist & Portfolio", desc: "Local-first with optional cloud sync.", icon: Lock },
];

const markets = [
  { flag: "🇮🇩", name: "IDX", desc: "Indonesia Stock Exchange, 900+ stocks" },
  { flag: "🇺🇸", name: "US Equities", desc: "NYSE & NASDAQ" },
  { flag: "₿", name: "Crypto", desc: "Major pairs via Yahoo Finance" },
];

// --- Counter Component ---
function AnimatedCounter({ end, suffix = "", visible }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!visible) return;
    let startTimestamp = null;
    const duration = 2000;
    const step = (timestamp) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      // easeOutExpo
      const easeProgress = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      setCount(Math.floor(easeProgress * end));
      if (progress < 1) {
        window.requestAnimationFrame(step);
      }
    };
    window.requestAnimationFrame(step);
  }, [end, visible]);

  return <>{count}{suffix}</>;
}

export default function LandingPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  
  // Vanta refs
  const vantaContainerRef = useRef(null);
  const vantaInstanceRef = useRef(null);
  
  // State
  const [clientReady, setClientReady] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [vantaReady, setVantaReady] = useState(false);
  const [statsVisible, setStatsVisible] = useState(false);
  const statsRef = useRef(null);

  // Load start state
  useEffect(() => {
    try {
      setHasStarted(localStorage.getItem(LANDING_STARTED_KEY) === "true");
    } catch {
      setHasStarted(false);
    } finally {
      setClientReady(true);
    }
  }, []);

  // Init Vanta
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

  // Intersection Observer for Stats
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setStatsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.5 }
    );
    if (statsRef.current) observer.observe(statsRef.current);
    return () => observer.disconnect();
  }, [clientReady]);

  // Redirect if already started
  useEffect(() => {
    if (!clientReady || loading || !hasStarted) return;
    router.replace(user ? "/portfolio-tracker" : "/explore");
  }, [clientReady, loading, hasStarted, user, router]);

  const handleStart = () => {
    try {
      localStorage.setItem(LANDING_STARTED_KEY, "true");
    } catch {
      // ignore
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

  const headlineWords = "A faster, cleaner way to read the financial market.".split(" ");

  return (
    <div className="relative min-h-screen w-full bg-[#060b13] text-white font-sans selection:bg-emerald-500/30">
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-word {
          opacity: 0;
          animation: fadeSlideUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        @keyframes tickerScroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-ticker {
          display: flex;
          width: max-content;
          animation: tickerScroll 40s linear infinite;
        }
        .animate-ticker:hover {
          animation-play-state: paused;
        }
      `}} />

      {/* SECTION 1: HERO */}
      <section className="relative flex min-h-screen w-full flex-col overflow-hidden pb-16 pt-10">
        <div ref={vantaContainerRef} className="absolute inset-0 z-0" />
        <div className="absolute inset-0 z-0 bg-[radial-gradient(circle_at_20%_0%,rgba(37,99,235,.14),transparent_45%),radial-gradient(circle_at_80%_10%,rgba(16,185,129,.1),transparent_42%),linear-gradient(180deg,rgba(2,6,13,.62),rgba(2,6,13,.95))]" />

        <div className="relative z-10 mx-auto w-full max-w-7xl flex-1 px-6 lg:px-12">
          {/* Header */}
          <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-[#081425]/60 px-4 py-3 backdrop-blur-xl md:px-5">
            <div className="flex items-center gap-2.5">
              <img src="/aruna.png" alt="aruna" className="size-7" />
              <span className="text-lg font-bold tracking-tight">aruna</span>
            </div>
            <Button variant="outline" className="rounded-full border-white/20 bg-transparent text-xs text-white hover:bg-white/10" onClick={() => router.push("/explore")}>
              Launch Console
            </Button>
          </div>

          <div className="mt-16 grid items-center gap-12 lg:mt-24 lg:grid-cols-2">
            {/* Left Content */}
            <div className="space-y-8">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1.5 text-xs font-semibold text-emerald-300 backdrop-blur-md">
                <Sparkles className="size-3.5" />
                Built for the modern investor workflow
              </div>
              <h1 className="text-5xl font-semibold leading-[1.1] tracking-tight sm:text-6xl lg:text-7xl">
                {headlineWords.map((word, i) => (
                  <span key={i} className="inline-block animate-word mr-[0.3em]" style={{ animationDelay: `${i * 0.08}s` }}>
                    {word}
                  </span>
                ))}
              </h1>
              <p className="max-w-xl text-base text-white/70 sm:text-lg">
                Aruna combines powerful market signals, advanced charting, and portfolio tracking into a seamless workspace designed for focused, decisive traders.
              </p>
              <div className="flex flex-wrap items-center gap-4">
                <Button className="h-12 rounded-full bg-emerald-500 px-8 text-base font-medium text-emerald-950 hover:bg-emerald-400 transition-all hover:scale-105" onClick={handleStart}>
                  Launch Console
                  <ArrowRight className="ml-2 size-4" />
                </Button>
              </div>
            </div>

            {/* Right Content - Sparkline */}
            <div className="hidden lg:block relative rounded-[2rem] border border-white/10 bg-[#0b1b2f]/40 p-8 shadow-2xl backdrop-blur-2xl">
              <div className="absolute inset-0 rounded-[2rem] ring-1 ring-inset ring-white/5" />
              <div className="mb-8 flex items-start justify-between">
                <div>
                  <h3 className="text-3xl font-bold tracking-tight text-white">BBCA</h3>
                  <p className="text-sm font-medium text-white/50">Bank Central Asia Tbk</p>
                </div>
                <div className="flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400">
                  <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
                  Live
                </div>
              </div>
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={sparklineData}>
                    <defs>
                      <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Area type="monotone" dataKey="price" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorPrice)" isAnimationActive={true} animationDuration={2000} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>

        {/* Ticker Strip */}
        <div className="absolute bottom-0 z-20 w-full overflow-hidden border-t border-white/5 bg-[#0b1b2f]/60 py-3 backdrop-blur-xl">
          <div className="animate-ticker">
            {[...tickerData, ...tickerData, ...tickerData].map((t, i) => (
              <div key={i} className="flex shrink-0 items-center gap-3 px-8">
                <span className="text-sm font-semibold tracking-wide text-white/80">{t.symbol}</span>
                <span className={`text-sm font-medium ${t.up ? "text-emerald-400" : "text-rose-400"}`}>
                  {t.change}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 2: FEATURE HIGHLIGHTS */}
      <section className="relative z-10 w-full border-t border-white/5 bg-[#060b13] py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-12">
          <div className="mb-16 max-w-2xl">
            <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">Institutional tools. Retail access.</h2>
            <p className="mt-4 text-white/60">Everything you need to analyze the market without the noise.</p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f, i) => (
              <div key={i} className="group relative rounded-3xl border border-white/5 bg-white/[0.02] p-8 transition-all duration-300 hover:-translate-y-1.5 hover:border-emerald-500/30 hover:bg-white/[0.04] hover:shadow-[0_0_40px_-15px_rgba(16,185,129,0.2)]">
                <div className="mb-6 inline-flex rounded-2xl border border-white/5 bg-[#0b1b2f] p-3.5 text-emerald-400 transition-colors group-hover:bg-emerald-500/10">
                  <f.icon className="size-6" />
                </div>
                <h3 className="mb-2 text-lg font-medium text-white/90">{f.name}</h3>
                <p className="text-sm leading-relaxed text-white/50">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 3: MARKET COVERAGE */}
      <section className="relative z-10 w-full border-t border-white/5 bg-[#081425] py-24">
        <div className="mx-auto max-w-7xl px-6 lg:px-12">
          <div className="mb-12 text-center">
            <h2 className="text-2xl font-semibold tracking-tight text-white/90">Global context in one platform</h2>
          </div>
          <div className="grid gap-6 sm:grid-cols-3">
            {markets.map((m, i) => (
              <div key={i} className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-md">
                <div className="absolute -right-10 -top-10 size-40 rounded-full bg-blue-500/10 blur-3xl" />
                <div className="relative z-10 flex items-center gap-4">
                  <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-white/10 text-2xl">
                    {m.flag}
                  </div>
                  <div>
                    <h4 className="font-semibold text-white/90">{m.name}</h4>
                    <p className="mt-1 text-xs text-white/50">{m.desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 4: SOCIAL PROOF / STATS */}
      <section ref={statsRef} className="relative z-10 w-full border-y border-white/5 bg-[#060b13] py-20">
        <div className="mx-auto max-w-7xl px-6 lg:px-12">
          <div className="grid grid-cols-2 gap-8 divide-white/10 sm:grid-cols-4 sm:divide-x">
            <div className="flex flex-col items-center justify-center text-center px-4">
              <span className="text-4xl font-bold tracking-tight text-white">
                <AnimatedCounter end={900} suffix="+" visible={statsVisible} />
              </span>
              <span className="mt-2 text-xs font-medium uppercase tracking-wider text-white/50">IDX Stocks Tracked</span>
            </div>
            <div className="flex flex-col items-center justify-center text-center px-4">
              <span className="text-4xl font-bold tracking-tight text-white">
                <AnimatedCounter end={3} visible={statsVisible} />
              </span>
              <span className="mt-2 text-xs font-medium uppercase tracking-wider text-white/50">Global Markets</span>
            </div>
            <div className="flex flex-col items-center justify-center text-center px-4">
              <span className="text-4xl font-bold tracking-tight text-emerald-400">Live</span>
              <span className="mt-2 text-xs font-medium uppercase tracking-wider text-white/50">Money Flow Data</span>
            </div>
            <div className="flex flex-col items-center justify-center text-center px-4">
              <span className="text-4xl font-bold tracking-tight text-sky-400">100%</span>
              <span className="mt-2 text-xs font-medium uppercase tracking-wider text-white/50">Local First</span>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 5: FINAL CTA */}
      <section className="relative z-10 w-full overflow-hidden bg-[#060b13] py-32 sm:py-40">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(16,185,129,0.15),transparent_60%)]" />
        <div className="relative mx-auto max-w-2xl px-6 text-center">
          <h2 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
            Start reading the market smarter.
          </h2>
          <p className="mt-6 text-lg text-white/60">
            Free to use. No account required for most features.
          </p>
          <div className="mt-10 flex items-center justify-center">
            <Button className="h-14 rounded-full bg-emerald-500 px-8 text-lg font-medium text-emerald-950 hover:bg-emerald-400 hover:scale-105 transition-all" onClick={handleStart}>
              Launch Console
              <ArrowRight className="ml-2 size-5" />
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
