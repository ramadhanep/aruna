"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

const APPEARANCE_MODE_KEY = "aruna_appearance_mode";
const DEFAULT_MODE = "pro";

const AppearanceModeContext = createContext({
  mode: DEFAULT_MODE,
  isLiteMode: false,
  setMode: () => {},
});

function readStoredMode() {
  if (typeof window === "undefined") return DEFAULT_MODE;
  try {
    const stored = localStorage.getItem(APPEARANCE_MODE_KEY);
    return stored === "lite" ? "lite" : DEFAULT_MODE;
  } catch {
    return DEFAULT_MODE;
  }
}

export function AppearanceModeProvider({ children }) {
  const [mode, setModeState] = useState(() => readStoredMode());

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.setAttribute("data-appearance-mode", mode);
  }, [mode]);

  const setMode = (nextMode) => {
    const normalized = nextMode === "lite" ? "lite" : DEFAULT_MODE;
    setModeState(normalized);
    try {
      localStorage.setItem(APPEARANCE_MODE_KEY, normalized);
    } catch (error) {
      console.warn("Failed to save appearance mode", error);
    }
  };

  const value = useMemo(
    () => ({
      mode,
      isLiteMode: mode === "lite",
      setMode,
    }),
    [mode]
  );

  return (
    <AppearanceModeContext.Provider value={value}>
      {children}
    </AppearanceModeContext.Provider>
  );
}

export function useAppearanceMode() {
  return useContext(AppearanceModeContext);
}
