"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Loader2, Clock, X } from "lucide-react";
import { fetchEncodedJson } from "@/lib/api-client";

const SEARCH_HISTORY_KEY = "aruna_header_symbol_history";

export function SymbolSearchDialog({ open, onOpenChange, onSelect, trigger }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = window.localStorage.getItem(SEARCH_HISTORY_KEY);
      if (stored) {
        setHistory(JSON.parse(stored));
      }
    } catch (error) {
      console.warn("Failed to load symbol history", error);
    }
  }, []);

  useEffect(() => {
    const normalizedQuery = query.trim();
    if (!normalizedQuery) {
      setResults([]);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);

    const timeout = setTimeout(async () => {
      try {
        const { response, data } = await fetchEncodedJson(
          `/api/symbol-search?q=${encodeURIComponent(normalizedQuery)}`,
          {
            signal: controller.signal,
          }
        );
        if (!response.ok) {
          throw new Error(data?.error || "Search failed");
        }
        setResults(Array.isArray(data.symbols) ? data.symbols.slice(0, 12) : []);
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

  const emptyState = useMemo(() => {
    if (loading) return null;
    if (!query.trim()) return null;
    if (results.length) return null;
    return (
      <p className="text-xs text-center text-muted-foreground py-8">
        No matches for &ldquo;{query.trim()}&rdquo;
      </p>
    );
  }, [loading, query, results]);

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
      <DialogContent className="fixed max-w-none h-screen rounded-none p-0 flex flex-col p-4" closeButtonPosition="right">
        <DialogHeader className="space-y-1">
          <DialogTitle className="text-base font-semibold">Search Symbol</DialogTitle>
        </DialogHeader>
        <div className="flex items-center gap-2">
          <Input
            autoFocus
            value={query}
            onChange={(event) => setQuery((event.target.value || '').toUpperCase())}
            placeholder="Search by symbol or company name"
            className="flex-1"
          />
        </div>

        <div className="max-h-full overflow-hidden rounded-md border">
          <div className="max-h-full overflow-y-auto">
            {loading && (
              <div className="flex items-center justify-center py-6 text-muted-foreground text-sm">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Searching...
              </div>
            )}

            {!loading && results.length > 0 && (
              <ul className="divide-y">
                {results.map((item) => (
                  <li key={item.symbol}>
                    <button
                      type="button"
                      onClick={() => handleSelect(item.symbol)}
                      className="w-full px-4 py-3 text-left hover:bg-accent transition-colors"
                    >
                      <p className="text-sm font-semibold uppercase">{item.symbol}</p>
                      {item.name && <p className="text-xs text-muted-foreground line-clamp-1">{item.name}</p>}
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {emptyState}

            {!query && history.length > 0 && (
              <div className="py-2">
                <div className="flex items-center justify-between px-4 pb-2">
                  <span className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" /> Recent
                  </span>
                  <Button variant="ghost" size="sm" className="text-xs h-7" onClick={clearHistory}>
                    Clear
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2 px-4 pb-3">
                  {history.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => handleSelect(item)}
                      className="rounded-full border px-3 py-1 text-xs font-medium hover:bg-accent"
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <Button variant="outline" className="w-full text-sm mt-2" onClick={() => handleOpenChange(false)}>
          Cancel
        </Button>
      </DialogContent>
    </Dialog>
  );
}

export function HeaderSymbolSearch() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const trigger = (
    <Button
      variant="ghost"
      size="icon"
      className="rounded-full p-2 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
      aria-label="Search symbol"
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
