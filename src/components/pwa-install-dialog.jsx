"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlignEndHorizontal } from "lucide-react";

const INSTALL_PROMPT_KEY = 'aruna_install_prompt_shown';

export function PWAInstallDialog() {
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
      <DialogContent className="max-w-sm">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <AlignEndHorizontal className="h-8 w-8 text-primary" />
          </div>
          <DialogTitle className="text-sm font-bold">Install Aruna</DialogTitle>
          <DialogDescription className="text-sm">
            Install aruna on your device for quick access and a better experience. No app store needed!
          </DialogDescription>
          <div className="flex w-full gap-2">
            <Button variant="outline" onClick={handleDismiss} className="flex-1 text-sm">
              Not Now
            </Button>
            <Button onClick={handleInstall} className="flex-1 bg-emerald-600 hover:bg-emerald-700 font-semibold text-sm">
              Install
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
