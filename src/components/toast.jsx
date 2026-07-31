"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { MOTION } from "@/lib/motion";

const listeners = new Set();
let counter = 0;

export function toast(message, { type = "error", duration = 4000 } = {}) {
  const id = ++counter;
  listeners.forEach((listener) => listener({ id, message, type, duration }));
}

export function ToastViewport() {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef(new Map());

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((t) => t.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) clearTimeout(timer);
    timersRef.current.delete(id);
  }, []);

  useEffect(() => {
    const listener = (next) => {
      setToasts((current) => [...current, next]);
      const timer = setTimeout(() => dismiss(next.id), next.duration);
      timersRef.current.set(next.id, timer);
    };
    listeners.add(listener);
    const timers = timersRef.current;
    return () => {
      listeners.delete(listener);
      timers.forEach(clearTimeout);
      timers.clear();
    };
  }, [dismiss]);

  if (toasts.length === 0) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex w-full max-w-sm flex-col gap-2 px-4"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            "flex items-start gap-2 rounded-xl border bg-background px-4 py-3 shadow-lg shadow-black/10 text-sm",
            MOTION.slideUp
          )}
        >
          {t.type === "success" ? (
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-500" />
          ) : (
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-red-500" />
          )}
          <p className="flex-1 text-foreground">{t.message}</p>
          <button
            type="button"
            onClick={() => dismiss(t.id)}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
