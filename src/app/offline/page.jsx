"use client";

import { WifiOff } from "lucide-react";

export default function Offline() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] gap-6 text-center px-4">
      <div className="p-5 rounded-full bg-muted/60">
        <WifiOff className="size-10 text-muted-foreground" />
      </div>
      <div className="space-y-2 max-w-xs">
        <h1 className="text-xl font-bold">You&apos;re offline</h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          It looks like you lost your internet connection. Some features may still work from cache.
        </p>
      </div>
      <button
        onClick={() => window.location.reload()}
        className="px-5 py-2.5 bg-primary text-primary-foreground text-sm font-semibold rounded-full hover:opacity-90 transition-opacity"
      >
        Try Again
      </button>
    </div>
  );
}
