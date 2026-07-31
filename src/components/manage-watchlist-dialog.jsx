"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Trash2, Plus, X, GripVertical } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { searchSymbols } from "@/lib/api-client";
import { formatTickerDisplay, cn } from "@/lib/utils";

export function ManageWatchlistDialog({ open, onOpenChange, watchlist, onSave }) {
  const [items, setItems] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const searchTimeoutRef = useRef(null);
  const prevOpenRef = useRef(false);

  // Radix Dialog is controlled: opening via the `open` prop does NOT fire
  // onOpenChange(true), so seed items from the watchlist prop on the open edge.
  useEffect(() => {
    if (open && !prevOpenRef.current) {
      const sorted = Array.isArray(watchlist)
        ? [...watchlist].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        : [];
      setItems(sorted);
      setSearchQuery("");
      setSearchResults([]);
    }
    prevOpenRef.current = open;
  }, [open, watchlist]);

  const handleOpenChange = useCallback((nextOpen) => {
    onOpenChange(nextOpen);
  }, [onOpenChange]);

  // Search for symbols (debounced)
  useEffect(() => {
    const normalizedQuery = searchQuery.trim();
    if (!normalizedQuery) return;

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(async () => {
      setSearchResults(await searchSymbols(normalizedQuery));
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

  // Drag-to-reorder via Pointer Events (touch: iOS 13.4+, Android Chrome; mouse included).
  // `touch-none` on the handle keeps the page scrollable while the handle itself drags.
  const listRef = useRef(null);
  const dragStateRef = useRef(null);
  const dragCleanupRef = useRef(null);
  const [draggingIndex, setDraggingIndex] = useState(null);

  const handleDragMove = useCallback((e) => {
    const state = dragStateRef.current;
    if (!state) return;
    const delta = e.clientY - state.startY;
    if (!state.armed) {
      if (Math.abs(delta) < 8) return;
      state.armed = true;
      setDraggingIndex(state.index);
    }
    const rows = listRef.current?.children;
    if (!rows) return;
    let target = state.index;
    for (let i = 0; i < rows.length; i++) {
      const rect = rows[i].getBoundingClientRect();
      if (e.clientY > rect.top + rect.height / 2) {
        target = i;
      }
    }
    if (target === state.index) return;
    const from = state.index;
    setItems((prev) => {
      if (from < 0 || from >= prev.length || target < 0 || target >= prev.length) {
        return prev;
      }
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(target, 0, moved);
      state.index = target;
      return next.map((item, idx) => ({ ...item, order: idx + 1 }));
    });
  }, []);

  const endDrag = useCallback(() => {
    dragCleanupRef.current?.();
  }, []);

  const handleDragStart = useCallback((e, index) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    dragStateRef.current = { index, startY: e.clientY, armed: false };
    const cleanup = () => {
      window.removeEventListener('pointermove', handleDragMove);
      window.removeEventListener('pointerup', endDrag);
      window.removeEventListener('pointercancel', endDrag);
      dragCleanupRef.current = null;
      dragStateRef.current = null;
      setDraggingIndex(null);
    };
    dragCleanupRef.current = cleanup;
    window.addEventListener('pointermove', handleDragMove);
    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);
  }, [handleDragMove, endDrag]);

  const handleSave = () => {
    onSave(items);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
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
            {searchQuery.trim() && searchResults.length > 0 && (
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
            <p className="text-xs text-muted-foreground mb-2">Drag to reorder</p>
            <div ref={listRef} className="space-y-2">
              {items.map((item, index) => (
                <div
                  key={item.symbol}
                  className={cn(
                    "flex items-center gap-2 p-3 border rounded-md bg-card transition-opacity",
                    draggingIndex === index && "opacity-60"
                  )}
                >
                  <button
                    type="button"
                    onPointerDown={(e) => handleDragStart(e, index)}
                    onKeyDown={(e) => {
                      if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        handleMove(index, -1);
                      }
                      if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        handleMove(index, 1);
                      }
                    }}
                    aria-label={`Reorder ${formatTickerDisplay(item.symbol)}`}
                    className="p-1.5 rounded hover:bg-accent cursor-grab touch-none"
                  >
                    <GripVertical className="size-4 text-muted-foreground" />
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm">{formatTickerDisplay(item.symbol)}</div>
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
