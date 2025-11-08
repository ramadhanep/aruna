"use client";

import { useCallback } from "react";
import { Cookie } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const STORAGE_KEYS = [
  "aruna_portfolio",
  "aruna_portfolio_updated_at",
  "portfolio_currency",
  "aruna_watchlist",
  "aruna_watchlist_updated_at",
  "aruna_search_history",
  "aruna_last_election_symbol",
];

export function ClearDataButton({
  trigger,
  onCleared,
  confirmLabel = "Yes, clear data",
} = {}) {
  const handleClear = useCallback(async () => {
    try {
      if (onCleared) {
        await onCleared();
      }
    } catch (error) {
      console.error("Failed to clear remote data", error);
    } finally {
      try {
        STORAGE_KEYS.forEach((key) => {
          localStorage.removeItem(key);
        });
        window.location.reload();
      } catch (error) {
        console.error("Failed to clear local data", error);
      }
    }
  }, [onCleared]);

  const defaultTrigger = (
    <button
      type="button"
      className="rounded-full p-2 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
      aria-label="Clear local data"
    >
      <Cookie className="h-5 w-5" />
    </button>
  );

  return (
    <Dialog>
      <DialogTrigger asChild>{trigger ?? defaultTrigger}</DialogTrigger>
      <DialogContent closeButtonPosition="right">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold">Reset data?</DialogTitle>
          <DialogDescription className="text-xs">
            This removes your stored portfolio, watchlist, preferences, and recent symbols. You can&apos;t undo this action.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button variant="destructive" onClick={handleClear}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
