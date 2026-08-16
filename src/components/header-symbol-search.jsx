"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { Search, Loader2, Clock } from "lucide-react";
import { searchSymbols } from "@/lib/api-client";
import { formatTickerDisplay, cn } from "@/lib/utils";

const SEARCH_HISTORY_KEY = "aruna_header_symbol_history";

export function SymbolSearchDialog({ open, onOpenChange, onSelect, trigger }) {
  const t = useTranslations("headerSymbolSearch");
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [history, setHistory] = useState(() => {
    if (typeof window === "undefined") return [];
    try {
      const stored = window.localStorage.getItem(SEARCH_HISTORY_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    const normalizedQuery = query.trim();
    if (!normalizedQuery) {
      queueMicrotask(() => {
        setResults([]);
        setLoading(false);
      });
      return;
    }

    const controller = new AbortController();
    queueMicrotask(() => setLoading(true));

    const timeout = setTimeout(async () => {
      try {
        const results = await searchSymbols(normalizedQuery, {
          signal: controller.signal,
        });
        setResults(results.slice(0, 12));
      } catch (error) {
        if (error.name !== "AbortError") {
          console.warn("Symbol search error", error);
          setResults([]);
        }
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      controller.abort();
      clearTimeout(timeout);
    };
  }, [query]);

  const handleSelect = useCallback(
    (symbol) => {
      if (!symbol) return;

      setHistory((prev) => {
        const nextHistory = [symbol, ...prev.filter((item) => item !== symbol)].slice(0, 8);
        try {
          if (typeof window !== "undefined") {
            window.localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(nextHistory));
          }
        } catch (error) {
          console.warn("Failed to persist symbol history", error);
        }
        return nextHistory;
      });

      const target = `/chart?symbol=${encodeURIComponent(symbol)}&cycle=normal`;
      if (onSelect) {
        onSelect(symbol);
      } else {
        router.push(target);
      }

      onOpenChange?.(false);
      setQuery("");
      setResults([]);
      setLoading(false);
    },
    [onSelect, onOpenChange, router]
  );

  const clearHistory = useCallback(() => {
    try {
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(SEARCH_HISTORY_KEY);
      }
    } catch (error) {
      console.warn("Failed to clear symbol history", error);
    }
    setHistory([]);
  }, []);

  const handleOpenChange = useCallback(
    (nextOpen) => {
      onOpenChange?.(nextOpen);
      if (!nextOpen) {
        setQuery("");
        setResults([]);
        setLoading(false);
      }
    },
    [onOpenChange]
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent variant="fullscreen" className="p-4" closeButtonPosition="right">
        <DialogHeader className="space-y-1">
          <DialogTitle className="text-base font-semibold">{t("title")}</DialogTitle>
        </DialogHeader>
        <div className="mt-2 flex items-center gap-2">
          <Input
            autoFocus
            value={query}
            onChange={(event) => setQuery((event.target.value || '').toUpperCase())}
            placeholder={t("placeholder")}
            className="flex-1"
          />
        </div>

        <Command className="mt-2 flex-1 min-h-0 max-h-full overflow-hidden rounded-md border bg-background">
          <CommandList>
            {loading && (
              <div className="flex items-center justify-center py-6 text-muted-foreground text-sm">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t("searching")}
              </div>
            )}

            {!query && history.length > 0 && (
              <CommandGroup
                heading={
                  <span className="flex items-center justify-between pr-2">
                    <span className="flex items-center gap-2">
                      <Clock className="h-3.5 w-3.5" /> {t("recent")}
                    </span>
                    <Button variant="ghost" size="sm" className="text-xs h-7" onClick={clearHistory}>
                      {t("clear")}
                    </Button>
                  </span>
                }
              >
                {history.map((item) => (
                  <CommandItem key={item} value={item} onSelect={() => handleSelect(item)}>
                    {formatTickerDisplay(item)}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {!loading && results.length > 0 && (
              <CommandGroup heading={t("results")}>
                {results.map((item) => (
                  <CommandItem key={item.symbol} value={item.symbol} onSelect={() => handleSelect(item.symbol)}>
                    <span className="flex-1">
                      <p className="text-sm font-semibold uppercase">{formatTickerDisplay(item.symbol)}</p>
                      {item.name && <p className="text-xs text-muted-foreground line-clamp-1">{item.name}</p>}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {query.trim() && !loading && !results.length && (
              <CommandEmpty>{t("noMatches", { query: query.trim() })}</CommandEmpty>
            )}
          </CommandList>
        </Command>

        <Button variant="outline" className="w-full text-sm mt-2" onClick={() => handleOpenChange(false)}>
          {t("cancel")}
        </Button>
      </DialogContent>
    </Dialog>
  );
}

export function HeaderSymbolSearch({ variant = "icon", className }) {
  const t = useTranslations("headerSymbolSearch");
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const trigger = variant === "input" ? (
    <Button
      type="button"
      variant="outline"
      className={cn(
        "h-9 w-[220px] justify-start rounded-md border-border bg-card px-3 text-muted-foreground hover:bg-accent md:w-[260px] xl:w-[320px]",
        className
      )}
      aria-label={t("triggerAria")}
    >
      <Search className="mr-2 size-4 shrink-0" />
      <span className="truncate text-xs font-normal">{t("triggerPlaceholder")}</span>
    </Button>
  ) : (
    <Button
      variant="ghost"
      size="icon"
      className={cn(
        "rounded-full p-2 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
        className
      )}
      aria-label={t("triggerAria")}
    >
      <Search className="size-5" />
    </Button>
  );

  const handleSelect = useCallback(
    (symbol) => {
      if (!symbol) return;
      router.push(`/chart?symbol=${encodeURIComponent(symbol)}&cycle=normal`);
    },
    [router]
  );

  return (
    <SymbolSearchDialog
      open={open}
      onOpenChange={setOpen}
      onSelect={(symbol) => {
        handleSelect(symbol);
        setOpen(false);
      }}
      trigger={trigger}
    />
  );
}
