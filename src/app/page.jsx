"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { 
  motion, 
  useScroll, 
  useTransform, 
  useSpring, 
  AnimatePresence,
  useInView
} from "framer-motion";
import { 
  ArrowRight, 
  BarChart3, 
  Database, 
  Globe2, 
  Network, 
  PieChart, 
  Lock, 
  Sparkles,
  Zap,
  TrendingUp,
  Search,
  LayoutDashboard
} from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";

const LANDING_STARTED_KEY = "aruna_landing_started";
const DASHBOARD_MOCKUP = "/dashboard-mockup.png";
const CHART_MOCKUP = "/chart-mockup.png";
const PORTFOLIO_MOCKUP = "/portfolio-mockup.png";

// --- Components ---

function Nav({ onLaunch }) {
  const [scrolled, setScrolled] = useState(false);
  
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollTo = (id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <motion.nav 
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      className={`fixed top-0 left-0 right-0 z-[100] transition-all duration-500 ${
        scrolled ? "py-4 bg-black/40 backdrop-blur-xl border-b border-white/5" : "py-8 bg-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src="/aruna.png" alt="aruna" className="size-10" />
          <span className="text-2xl font-bold tracking-tighter text-white">aruna</span>
        </div>
        
        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-white/60">
          <button onClick={() => scrollTo('features')} className="hover:text-emerald-400 transition-colors">Features</button>
          <button onClick={() => scrollTo('why-aruna')} className="hover:text-emerald-400 transition-colors">Why Aruna</button>
        </div>

        <Button 
          variant="outline" 
          className="rounded-full border-white/10 bg-white/5 text-white hover:bg-emerald-500/10 hover:text-emerald-400 hover:border-emerald-500 transition-all duration-300"
          onClick={onLaunch}
        >
          Launch Terminal
        </Button>
      </div>
    </motion.nav>
  );
}

function HeroSection() {
  const containerRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end start"]
  });

  const opacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);
  const scale = useTransform(scrollYProgress, [0, 0.8], [1, 0.8]);
  const rotateX = useTransform(scrollYProgress, [0, 0.8], [0, 15]);

  return (
    <section ref={containerRef} className="relative h-[120vh] w-full">
      <motion.div 
        style={{ opacity, scale, rotateX, perspective: 1000 }}
        className="sticky top-0 h-screen w-full flex flex-col items-center justify-center text-center px-6"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(16,185,129,0.12),transparent_70%)]" />
        
        <motion.div 
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative z-10 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold uppercase tracking-widest mb-8"
        >
          <Sparkles className="size-3" />
          Intelligence for the Modern Trader
        </motion.div>
        
        <h1 className="relative z-10 text-6xl md:text-8xl lg:text-9xl font-bold tracking-tighter text-white mb-8">
          DECODE THE <br /> 
          <span className="text-transparent bg-clip-text bg-gradient-to-b from-emerald-400 to-emerald-600">MARKET.</span>
        </h1>
        
        <p className="relative z-10 max-w-2xl text-lg md:text-xl text-white/50 font-medium leading-relaxed">
          Aruna transform chaotic market data into actionable signals. <br className="hidden md:block" />
          Institutional-grade tools, reimagined for focus and speed.
        </p>

        <motion.div 
          animate={{ y: [0, 10, 0] }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="absolute bottom-12 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-white/20"
        >
          <span className="text-[10px] uppercase tracking-[0.3em] font-bold">Scroll to Explore</span>
          <div className="w-[1px] h-12 bg-gradient-to-b from-emerald-500/50 to-transparent" />
        </motion.div>
      </motion.div>
    </section>
  );
}

function FeatureSection({ id, title, description, icon: Icon, image, reverse = false }) {
  const containerRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end start"]
  });

  const opacity = useTransform(scrollYProgress, [0, 0.3, 0.7, 1], [0, 1, 1, 0]);
  const scale = useTransform(scrollYProgress, [0, 0.3, 0.7, 1], [0.8, 1, 1, 0.8]);
  const rotateY = useTransform(scrollYProgress, [0, 0.3, 0.7, 1], [reverse ? -10 : 10, 0, 0, reverse ? 10 : -10]);
  const textX = useTransform(scrollYProgress, [0, 0.3, 0.7, 1], [reverse ? 150 : -150, 0, 0, reverse ? 150 : -150]);
  const imgX = useTransform(scrollYProgress, [0, 0.3, 0.7, 1], [reverse ? -150 : 150, 0, 0, reverse ? -150 : 150]);

  return (
    <section id={id} ref={containerRef} className="relative h-[120vh] w-full">
      <motion.div 
        style={{ opacity, scale, rotateY, perspective: 1500 }}
        className="sticky top-0 h-screen w-full flex flex-col lg:flex-row items-center justify-center gap-12 px-6 lg:px-24 overflow-hidden"
      >
        <motion.div style={{ x: textX }} className={`flex-1 space-y-8 max-w-xl ${reverse ? "lg:order-2" : ""}`}>
          <div className="size-16 rounded-3xl bg-emerald-500 flex items-center justify-center text-black shadow-[0_0_40px_-5px_rgba(16,185,129,0.5)]">
            <Icon className="size-8" />
          </div>
          <div className="space-y-4">
            <h2 className="text-4xl md:text-6xl font-bold tracking-tight text-white leading-tight">{title}</h2>
            <p className="text-lg md:text-xl text-white/60 leading-relaxed">{description}</p>
          </div>
          <div className="flex items-center gap-8">
            <div className="flex flex-col">
              <span className="text-4xl font-bold text-emerald-400">900+</span>
              <span className="text-[10px] uppercase tracking-widest text-white/40 font-bold">IDX Symbols</span>
            </div>
            <div className="w-[1px] h-10 bg-white/10" />
            <div className="flex flex-col">
              <span className="text-4xl font-bold text-white">Live</span>
              <span className="text-[10px] uppercase tracking-widest text-white/40 font-bold">Data Stream</span>
            </div>
          </div>
        </motion.div>
        
        <motion.div 
          style={{ x: imgX }}
          className="flex-1 relative group w-full max-w-2xl"
        >
          <div className="absolute -inset-4 bg-emerald-500/10 blur-3xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
          <div className="relative aspect-video rounded-3xl overflow-hidden border border-white/10 shadow-2xl shadow-emerald-500/5 bg-black/40 backdrop-blur-sm p-4">
            <img 
              src={image} 
              alt={title} 
              className="w-full h-full object-contain grayscale-[0.5] group-hover:grayscale-0 group-hover:scale-105 transition-all duration-700"
            />
          </div>
        </motion.div>
      </motion.div>
    </section>
  );
}

function FinalCTA({ onLaunch }) {
  const containerRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end end"]
  });

  const opacity = useTransform(scrollYProgress, [0, 0.7], [0, 1]);
  const scale = useTransform(scrollYProgress, [0, 0.7], [0.8, 1]);
  const y = useTransform(scrollYProgress, [0, 0.7], [100, 0]);

  return (
    <section id="why-aruna" ref={containerRef} className="relative h-[80vh] w-full flex items-center justify-center overflow-hidden">
      <div className="absolute inset-0 bg-emerald-500/[0.03]" />
      <motion.div 
        style={{ opacity, scale, y }}
        className="relative z-10 flex flex-col items-center text-center px-6"
      >
        <div className="relative mb-12">
          <div className="absolute -inset-32 bg-emerald-500/30 blur-[140px] rounded-full animate-pulse" />
          <h2 className="relative text-6xl md:text-8xl font-bold tracking-tighter text-white leading-none">
            READY TO <br />
            <span className="text-emerald-400">LEVEL UP?</span>
          </h2>
        </div>
        <p className="max-w-xl text-white/60 text-lg md:text-xl mb-12 leading-relaxed">
          Join the next generation of investors. Local-first, privacy-focused, and incredibly fast.
        </p>
        <Button 
          size="lg"
          className="h-16 px-14 rounded-full bg-emerald-500 text-black text-2xl font-semibold hover:bg-emerald-400 hover:scale-110 transition-all duration-500 shadow-[0_0_60px_-10px_rgba(16,185,129,0.6)] group"
          onClick={onLaunch}
        >
          Launch Terminal
          <ArrowRight className="ml-2 size-8 group-hover:translate-x-3 transition-transform duration-500" />
        </Button>
      </motion.div>
    </section>
  );
}

// --- Main Page ---

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
      <div className="min-h-screen w-full bg-black text-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-6">
          <div className="size-16 bg-emerald-500 rounded-3xl animate-spin" />
          <p className="text-white/40 font-bold tracking-[0.2em] uppercase text-[10px]">Initializing Terminal</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-black text-white font-sans selection:bg-emerald-500/20 overflow-x-hidden">
      <Nav onLaunch={handleStart} />

      <HeroSection />

      <div id="features">
        <FeatureSection 
          title="Institutional Data."
          description="Track institutional money flow with precision. We process millions of data points to highlight where the 'smart money' is moving in real-time."
          icon={Database}
          image={DASHBOARD_MOCKUP}
        />

        <FeatureSection 
          title="Advanced Charting."
          description="Overlay seasonal patterns, election cycles, and technical signals on a single high-performance canvas. Built for clarity and speed."
          icon={BarChart3}
          image={CHART_MOCKUP}
          reverse
        />

        <FeatureSection 
          title="Private by Design."
          description="Your portfolio data stays local. We prioritize your privacy with local-first storage and optional end-to-end encrypted sync."
          icon={Lock}
          image={PORTFOLIO_MOCKUP}
        />
      </div>

      <FinalCTA onLaunch={handleStart} />

      {/* Static Footer Sections */}
      <footer className="relative z-10 bg-black py-32 px-6 border-t border-white/5">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-12">
          <div className="space-y-8">
            <div className="flex items-center gap-3">
              <img src="/aruna.png" alt="aruna" className="size-8" />
              <span className="text-xl font-bold tracking-tighter text-white">aruna</span>
            </div>
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-white">Market Pulse</h3>
              <p className="text-white/40 text-sm leading-relaxed">
                Aruna monitors IDX, US Equities, and Crypto markets simultaneously to provide global context for local decisions.
              </p>
              <div className="flex gap-4">
                <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] font-bold uppercase tracking-wider text-white/60">Idx</span>
                <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] font-bold uppercase tracking-wider text-white/60">Nyse</span>
                <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] font-bold uppercase tracking-wider text-white/60">Crypto</span>
              </div>
            </div>
          </div>
          <div className="space-y-6">
            <h3 className="text-lg font-bold text-white">Focus First</h3>
            <p className="text-white/40 text-sm leading-relaxed">
              No ads, no noise, no distractions. Just the data you need to execute your strategy with absolute confidence.
            </p>
            <div className="grid grid-cols-2 gap-4 text-sm text-white/40">
              <a href="#" className="hover:text-emerald-400 transition-colors">Documentation</a>
              <a href="#" className="hover:text-emerald-400 transition-colors">Twitter (X)</a>
              <a href="#" className="hover:text-emerald-400 transition-colors">Github</a>
              <a href="#" className="hover:text-emerald-400 transition-colors">Support</a>
            </div>
          </div>
          <div className="space-y-6">
            <h3 className="text-lg font-bold text-white">Open Terminal</h3>
            <p className="text-white/40 text-sm leading-relaxed">
              Ready to start? No account required for explorer features.
            </p>
            <Button 
              size="lg"
              className="w-full justify-center gap-2 rounded-2xl bg-emerald-500 text-black font-bold hover:bg-emerald-400" 
              onClick={handleStart}
            >
              Go to Explore
              <ArrowRight className="size-4" />
            </Button>
          </div>
        </div>
        
        <div className="max-w-7xl mx-auto mt-32 pt-12 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="text-[11px] text-white/30 font-medium">
            © 2026 Aruna Intelligence. All rights reserved.
          </div>
          <div className="flex gap-8 text-[11px] font-bold uppercase tracking-[0.2em] text-white/20">
            <a href="#" className="hover:text-white transition-colors">Terms</a>
            <a href="#" className="hover:text-white transition-colors">Privacy</a>
            <a href="#" className="hover:text-white transition-colors">Cookies</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
