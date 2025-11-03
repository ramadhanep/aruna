"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Loader2, Clock, X } from "lucide-react";

const SEARCH_HISTORY_KEY = "aruna_header_symbol_history";

export function HeaderSymbolSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [history, setHistory] = useState([]);
  const router = useRouter();

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
    if (!query.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);

    const timeout = setTimeout(async () => {
      try {
        const res = await fetch(`/api/symbol-search?q=${encodeURIComponent(query.trim())}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error("Search failed");
        const json = await res.json();
        setResults(Array.isArray(json.symbols) ? json.symbols.slice(0, 12) : []);
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

  const handleSelect = (symbol) => {
    if (!symbol) return;

    try {
      const nextHistory = [symbol, ...history.filter((item) => item !== symbol)].slice(0, 8);
      setHistory(nextHistory);
      window.localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(nextHistory));
    } catch (error) {
      console.warn("Failed to persist symbol history", error);
    }

    setOpen(false);
    setQuery("");
    setResults([]);
    router.push(`/election-cycle?symbol=${encodeURIComponent(symbol)}`);
  };

  const clearHistory = () => {
    try {
      window.localStorage.removeItem(SEARCH_HISTORY_KEY);
    } catch (error) {
      console.warn("Failed to clear symbol history", error);
    }
    setHistory([]);
  };

  const emptyState = useMemo(() => {
    if (loading) return null;
    if (!query.trim()) return null;
    if (results.length) return null;
    return (
      <p className="text-xs text-center text-muted-foreground py-8">
        No matches for "{query.trim()}"
      </p>
    );
  }, [loading, query, results]);

  const handleOpenChange = (nextOpen) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      setQuery("");
      setResults([]);
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full p-2 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2" aria-label="Search symbol">
          <Search className="size-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="fixed max-w-none h-screen rounded-none p-0 flex flex-col p-4" closeButtonPosition="right">
        <DialogHeader className="space-y-1">
          <DialogTitle className="text-base font-semibold">Search Symbol</DialogTitle>
        </DialogHeader>
        <div className="flex items-center gap-2">
          <Input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by symbol or company name"
            className="flex-1"
          />
          {query && (
            <Button variant="ghost" size="icon-sm" aria-label="Clear search" onClick={() => setQuery("")}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        <div className="max-h-72 overflow-hidden rounded-md border">
          <div className="max-h-72 overflow-y-auto">
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

        <DialogClose asChild>
          <Button variant="outline" className="w-full text-sm mt-2">Cancel</Button>
        </DialogClose>
      </DialogContent>
    </Dialog>
  );
}
