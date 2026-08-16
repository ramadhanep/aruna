"use client";

import { useCallback } from "react";
import { Cookie } from "lucide-react";
import { useTranslations } from "next-intl";
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
import { PORTFOLIO_STORAGE_KEYS } from "@/lib/portfolio-storage";

const STORAGE_KEYS = [
  ...PORTFOLIO_STORAGE_KEYS,
  "aruna_watchlist",
  "aruna_watchlist_updated_at",
  "aruna_search_history",
  "aruna_last_election_symbol",
  "aruna_appearance_mode",
  "aruna_landing_started",
];

export function ClearDataButton({
  trigger,
  onCleared,
  confirmLabel,
} = {}) {
  const t = useTranslations("clearData");  const handleClear = useCallback(async () => {
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
      aria-label={t("ariaLabel")}
    >
      <Cookie className="h-5 w-5" />
    </button>
  );

  return (
    <Dialog>
      <DialogTrigger asChild>{trigger ?? defaultTrigger}</DialogTrigger>
      <DialogContent closeButtonPosition="right">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold">{t("title")}</DialogTitle>
          <DialogDescription className="text-xs">
            {t("description")}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">{t("cancel")}</Button>
          </DialogClose>
          <Button variant="destructive" onClick={handleClear}>
            {confirmLabel ?? t("confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
