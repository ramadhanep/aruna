"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Star, AlignHorizontalDistributeCenter, ChartPie, LayoutGrid, UserRound, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { DURATION_CLASS } from "@/lib/motion";
import { HeaderSymbolSearch } from "@/components/header-symbol-search";
import { ModeToggle } from "@/components/mode-toggle";
import { LanguageToggle } from "@/components/language-toggle";
import { TOOLS_ITEMS } from "@/lib/tools-menu";

const navItems = [
  {
    key: "explore",
    url: "/explore",
    icon: LayoutGrid,
  },
  {
    key: "supercharts",
    url: "/chart",
    icon: AlignHorizontalDistributeCenter,
  },
  {
    key: "watchlist",
    url: "/watchlist",
    icon: Star,
  },
  {
    key: "portfolio",
    url: "/portfolio-tracker",
    icon: ChartPie,
  },
];

export function DesktopNavbar({ onOpenAccountSidebar }) {
  const pathname = usePathname();
  const t = useTranslations("desktopNavbar");
  const [toolsOpen, setToolsOpen] = useState(false);
  const toolsRef = useRef(null);
  const timeoutRef = useRef(null);

  const isToolsActive = TOOLS_ITEMS.some((item) => pathname === item.url);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const handleMouseEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setToolsOpen(true);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => setToolsOpen(false), 200);
  };

  return (
    <header className="hidden lg:flex items-center h-16 sticky top-0 z-40 bg-background/95 border-b border-border">
      <div className="flex items-center w-full max-w-[1400px] mx-auto px-6 gap-1">
        {/* Logo */}
        <Link href="/explore" className="flex items-center gap-2.5 mr-8 shrink-0">
          <Image src="/aruna.png" alt="aruna" width={28} height={28} className="size-7" />
          <span className="text-lg font-bold tracking-tight">aruna</span>
        </Link>

        {/* Nav Items */}
        <nav className="flex items-center gap-0.5 flex-1">
          {navItems.map((item) => {
            const isActive = pathname === item.url;
            const Icon = item.icon;

            return (
              <Link
                key={item.url}
                href={item.url}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-md text-[13px] font-medium transition-colors",
                  DURATION_CLASS.fast,
                  isActive
                    ? "bg-accent text-foreground font-semibold"
                    : "text-muted-foreground hover:bg-accent/70 hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{t(`nav.${item.key}`)}</span>
              </Link>
            );
          })}

          {/* Tools Dropdown */}
          <div
            ref={toolsRef}
            className="relative"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            <button
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 rounded-md text-[13px] font-medium transition-colors",
                DURATION_CLASS.fast,
                isToolsActive
                  ? "bg-accent text-foreground font-semibold"
                  : "text-muted-foreground hover:bg-accent/70 hover:text-foreground"
              )}
              onClick={() => setToolsOpen(!toolsOpen)}
            >
              <span>{t("tools")}</span>
              <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", DURATION_CLASS.fast, toolsOpen && "rotate-180")} />
            </button>

            {toolsOpen && (
              <div className={`absolute top-full left-0 mt-2 w-64 rounded-lg border border-border bg-popover py-2 z-50 animate-in fade-in slide-in-from-top-2 ${DURATION_CLASS.fast} shadow-lg shadow-black/10`}>
                {TOOLS_ITEMS.map((item) => {
                  const isActive = !item.external && pathname === item.url;
                  const Icon = item.icon;
                  const linkProps = item.external
                    ? { href: item.url, target: "_blank", rel: "noopener noreferrer" }
                    : { href: item.url };
                  const LinkComponent = item.external ? "a" : Link;
                  return (
                    <LinkComponent
                      key={item.url}
                      {...linkProps}
                      onClick={() => setToolsOpen(false)}
                      className={cn(
                        "flex items-center gap-3 px-3.5 py-2.5 mx-1 rounded-md text-[13px] transition-colors",
                        isActive
                          ? "bg-accent text-foreground font-semibold"
                          : "text-muted-foreground hover:bg-accent/70 hover:text-foreground"
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <div>
                        <p className="font-medium text-foreground">{item.title}</p>
                        <p className="text-1xs text-muted-foreground">{item.desc}</p>
                      </div>
                    </LinkComponent>
                  );
                })}
              </div>
            )}
          </div>
        </nav>

        {/* Right Side */}
        <div className="flex items-center gap-2 ml-auto">
          <HeaderSymbolSearch variant="input" />
          <ModeToggle />
          <LanguageToggle />
          <button
            onClick={onOpenAccountSidebar}
            className="flex items-center justify-center h-8 w-8 rounded-md bg-card hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
            aria-label={t("profile")}
          >
            <UserRound className="size-5" />
          </button>
        </div>
      </div>
    </header>
  );
}
