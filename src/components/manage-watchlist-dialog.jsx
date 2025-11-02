"use client";

import { useState, useEffect, useRef } from "react";
import { GripVertical, Trash2, Plus, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ManageWatchlistDialog({ open, onOpenChange, watchlist, onSave }) {
  const [items, setItems] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState(null);
  const searchTimeoutRef = useRef(null);

  useEffect(() => {
    if (open) {
      setItems([...watchlist]);
      setSearchQuery("");
      setSearchResults([]);
    }
  }, [open, watchlist]);

  // Search for symbols
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`/api/symbol-search?q=${encodeURIComponent(searchQuery)}`);
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.symbols || []);
        }
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

    const maxOrder = items.length > 0 ? Math.max(...items.map(i => i.order)) : 0;
    const newItem = { symbol, order: maxOrder + 1 };
    setItems([...items, newItem]);
    setSearchQuery("");
    setSearchResults([]);
  };

  const handleRemove = (symbol) => {
    const filtered = items.filter(item => item.symbol !== symbol);
    // Reorder remaining items
    const reordered = filtered.map((item, idx) => ({
      ...item,
      order: idx + 1
    }));
    setItems(reordered);
  };

  const handleDragStart = (index) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newItems = [...items];
    const draggedItem = newItems[draggedIndex];
    newItems.splice(draggedIndex, 1);
    newItems.splice(index, 0, draggedItem);

    // Update order numbers
    const reordered = newItems.map((item, idx) => ({
      ...item,
      order: idx + 1
    }));

    setItems(reordered);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const handleSave = () => {
    onSave(items);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="fixed max-w-none m-0 h-screen rounded-none p-0 flex flex-col" closeButtonPosition="right">
        <DialogHeader className="p-6 pb-4">
          <DialogTitle>Manage Watchlist</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6">
          {/* Search and Add */}
          <div className="mb-4">
            <div className="relative">
              <Input
                placeholder="Search symbol..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pr-10"
              />
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setSearchResults([]);
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Search Results */}
            {searchResults.length > 0 && (
              <div className="mt-2 border rounded-md divide-y max-h-[200px] overflow-y-auto bg-card">
                {searchResults.map((result) => (
                  <button
                    key={result.symbol}
                    onClick={() => handleAddSymbol(result.symbol)}
                    className="w-full px-3 py-2 text-left hover:bg-accent transition-colors flex items-center justify-between"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm">{result.symbol}</div>
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
            <p className="text-xs text-muted-foreground mb-2">Hold and drag to reorder</p>
            {items.map((item, index) => (
              <div
                key={item.symbol}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragEnd={handleDragEnd}
                className={`flex items-center gap-3 p-3 border rounded-md bg-card cursor-move transition-all ${
                  draggedIndex === index ? 'opacity-50' : ''
                }`}
              >
                <GripVertical className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold">{item.symbol}</div>
                </div>
                <button
                  onClick={() => handleRemove(item.symbol)}
                  className="text-red-500 hover:text-red-600 transition-colors"
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
          <Button onClick={handleSave} className="bg-lime-500 hover:bg-lime-600">
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
