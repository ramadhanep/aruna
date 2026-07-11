"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth-provider";

const TRIAL_STORAGE_KEY = "aruna-trial-state";
const TRIAL_DURATION_MS = 10 * 60 * 1000;

function readStoredTrial() {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(TRIAL_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeStoredTrial(value) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(TRIAL_STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Ignore storage failures for the temporary trial flow.
  }
}

function deriveTrialState(stored, now = Date.now()) {
  if (!stored?.startedAt || !stored?.expiresAt) {
    const startedAt = now;
    const expiresAt = now + TRIAL_DURATION_MS;
    return {
      startedAt,
      expiresAt,
      isActive: true,
      isExpired: false,
      remainingMs: TRIAL_DURATION_MS,
      remainingSeconds: Math.ceil(TRIAL_DURATION_MS / 1000),
    };
  }

  const remainingMs = Math.max(0, stored.expiresAt - now);
  const isExpired = remainingMs === 0;

  return {
    startedAt: stored.startedAt,
    expiresAt: stored.expiresAt,
    isActive: !isExpired,
    isExpired,
    remainingMs,
    remainingSeconds: Math.ceil(remainingMs / 1000),
  };
}

const TrialContext = createContext({
  initialized: false,
  isGuest: false,
  startedAt: null,
  expiresAt: null,
  isActive: false,
  isExpired: true,
  remainingMs: 0,
  remainingSeconds: 0,
  trialDurationMs: TRIAL_DURATION_MS,
});

export function TrialProvider({ children }) {
  const { user, loading } = useAuth();
  const [trial, setTrial] = useState({
    initialized: false,
    isGuest: false,
    startedAt: null,
    expiresAt: null,
    isActive: false,
    isExpired: true,
    remainingMs: 0,
    remainingSeconds: 0,
  });

  useEffect(() => {
    if (loading) return;

    if (user) {
      setTrial({
        initialized: true,
        isGuest: false,
        startedAt: null,
        expiresAt: null,
        isActive: false,
        isExpired: false,
        remainingMs: 0,
        remainingSeconds: 0,
      });
      return;
    }

    const stored = readStoredTrial();
    const next = deriveTrialState(stored, Date.now());

    if (!stored?.startedAt || !stored?.expiresAt) {
      writeStoredTrial({ startedAt: next.startedAt, expiresAt: next.expiresAt });
    }

    setTrial({ ...next, initialized: true, isGuest: true });
  }, [loading, user]);

  useEffect(() => {
    if (loading || user || !trial.initialized || !trial.isGuest) return;

    const interval = window.setInterval(() => {
      const stored = readStoredTrial();
      setTrial({ ...deriveTrialState(stored, Date.now()), initialized: true, isGuest: true });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [loading, user, trial.initialized, trial.isGuest]);

  const value = useMemo(
    () => ({
      ...trial,
      trialDurationMs: TRIAL_DURATION_MS,
    }),
    [trial]
  );

  return <TrialContext.Provider value={value}>{children}</TrialContext.Provider>;
}

export function useTrial() {
  return useContext(TrialContext);
}
