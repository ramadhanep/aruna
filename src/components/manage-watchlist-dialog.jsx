"use client";

import { useState, useEffect, useRef } from "react";
import { Trash2, Plus, X, ArrowBigUpDash, ArrowBigDownDash } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetchEncodedJson } from "@/lib/api-client";
import { formatTickerDisplay } from "@/lib/utils";

export function ManageWatchlistDialog({ open, onOpenChange, watchlist, onSave }) {
  const [items, setItems] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeoutRef = useRef(null);

  useEffect(() => {
    if (open) {
      // Ensure items are sorted by order when opening
      const sorted = Array.isArray(watchlist)
        ? [...watchlist].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        : [];
      setItems(sorted);
      setSearchQuery("");
      setSearchResults([]);
    }
  }, [open, watchlist]);

  // Search for symbols (debounced)
  useEffect(() => {
    const normalizedQuery = searchQuery.trim();
    if (!normalizedQuery) {
      setSearchResults([]);
      return;
    }

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const { response, data } = await fetchEncodedJson(
          `/api/symbol-search?q=${encodeURIComponent(normalizedQuery)}`
        );
        if (!response.ok) {
          throw new Error(data?.error || "Search failed");
        }
        setSearchResults(data.symbols || []);
      } catch (e) {
        console.warn('Search failed', e);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  const handleAddSymbol = (symbol) => {
    // Check if already in watchlist
    if (items.some(item => item.symbol === symbol)) {
      return;
    }

    const maxOrder = items.length > 0 ? Math.max(...items.map(i => i.order ?? 0)) : 0;
    const newItem = { symbol, order: maxOrder + 1 };
    const next = [...items, newItem].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    setItems(next);
    setSearchQuery("");
    setSearchResults([]);
  };

  const handleRemove = (symbol) => {
    const filtered = items.filter(item => item.symbol !== symbol);
    // Reorder remaining items to keep order contiguous
    const reordered = filtered.map((item, idx) => ({
      ...item,
      order: idx + 1
    }));
    setItems(reordered);
  };

  const handleMove = (index, delta) => {
    const newIndex = index + delta;
    if (newIndex < 0 || newIndex >= items.length) return;

    const newItems = [...items];
    const [moved] = newItems.splice(index, 1);
    newItems.splice(newIndex, 0, moved);

    // Normalize order numbers after move
    const reordered = newItems.map((item, idx) => ({
      ...item,
      order: idx + 1,
    }));

    setItems(reordered);
  };

  const handleSave = () => {
    onSave(items);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent variant="fullscreen" closeButtonPosition="right">
        <DialogHeader className="p-6 pb-4">
          <DialogTitle className="text-base font-semibold">Manage Watchlist</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-4">
          {/* Search and Add */}
          <div className="relative mb-4">
            <div className="relative">
              <Input
                placeholder="Search ticker..."
                value={searchQuery}
                onChange={(e) => setSearchQuery((e.target.value || '').toUpperCase())}
                className="pr-10"
              />
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setSearchResults([]);
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Search Results */}
            {searchResults.length > 0 && (
              <div className="absolute top-full inset-x-0 z-20 mt-2 border rounded-md divide-y max-h-[200px] overflow-y-auto bg-card shadow-md">
                {searchResults.map((result) => (
                  <button
                    key={result.symbol}
                    onClick={() => handleAddSymbol(result.symbol)}
                    className="w-full px-3 py-2 text-left hover:bg-accent transition-colors flex items-center justify-between"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm">{formatTickerDisplay(result.symbol)}</div>
                      <div className="text-xs text-muted-foreground truncate">{result.name}</div>
                    </div>
                    <Plus className="h-4 w-4 text-muted-foreground ml-2 flex-shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Watchlist Items */}
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground mb-2">Tap arrows to reorder</p>
            {items.map((item, index) => (
              <div
                key={item.symbol}
                className="flex items-center gap-3 p-3 border rounded-md bg-card"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm">{formatTickerDisplay(item.symbol)}</div>
                </div>

                {/* Up/Down controls (replace drag handle) */}
                <div className="flex gap-2 mr-1 pr-3 border-r">
                  <button
                    type="button"
                    onClick={() => handleMove(index, -1)}
                    disabled={index === 0}
                    aria-label="Move up"
                    className="p-1 rounded hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <ArrowBigUpDash className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMove(index, 1)}
                    disabled={index === items.length - 1}
                    aria-label="Move down"
                    className="p-1 rounded hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <ArrowBigDownDash className="size-4" />
                  </button>
                </div>

                <button
                  onClick={() => handleRemove(item.symbol)}
                  className="text-red-600 hover:text-red-600 transition-colors"
                  aria-label={`Remove ${formatTickerDisplay(item.symbol)}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>

          {items.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <p>No symbols in watchlist</p>
              <p className="text-sm mt-1">Search and add symbols above</p>
            </div>
          )}
        </div>

        <DialogFooter className="p-6 pt-4 border-t">
          <Button onClick={handleSave}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
