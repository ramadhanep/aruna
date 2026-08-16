"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";


const INSTALL_PROMPT_KEY = 'aruna_install_prompt_shown';

export function PWAInstallDialog() {
  const t = useTranslations("pwaInstallDialog");
  const [open, setOpen] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);

  useEffect(() => {
    // Check if already shown
    const hasShown = localStorage.getItem(INSTALL_PROMPT_KEY);

    // Check if already installed (running as standalone)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true;

    if (hasShown || isStandalone) {
      return;
    }

    // Listen for beforeinstallprompt event
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setOpen(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      console.log('User accepted the install prompt');
    }

    setDeferredPrompt(null);
    setOpen(false);
    localStorage.setItem(INSTALL_PROMPT_KEY, 'true');
  };

  const handleDismiss = () => {
    setOpen(false);
    localStorage.setItem(INSTALL_PROMPT_KEY, 'true');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-sm" closeButtonPosition="right">
        <div className="flex flex-col items-center gap-4 text-center">
          <Image src="/aruna.png" alt="aruna" width={48} height={48} className="h-12 w-12" />
          <DialogTitle className="text-sm font-bold">{t("installTitle")}</DialogTitle>
          <DialogDescription className="text-sm">
            {t("installDescription")}
          </DialogDescription>
          <div className="flex w-full gap-2">
            <Button variant="outline" onClick={handleDismiss} className="flex-1 text-sm">
              {t("notNow")}
            </Button>
            <Button onClick={handleInstall} className="flex-1 font-semibold text-sm">
              {t("install")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
