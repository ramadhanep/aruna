"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";

export function ModeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();

  const activeMode = theme === "system" ? resolvedTheme ?? "light" : theme ?? "light";

  const cycleTheme = () => {
    if (theme === "light") {
      setTheme("dark");
      return;
    }
    if (theme === "dark") {
      setTheme("system");
      return;
    }
    setTheme("light");
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={cycleTheme}
      className="h-9 w-9"
    >
      <Sun className={`h-[1.2rem] w-[1.2rem] transition-all ${activeMode === "dark" ? "-rotate-90 scale-0" : "rotate-0 scale-100"}`} />
      <Moon className={`absolute h-[1.2rem] w-[1.2rem] transition-all ${activeMode === "dark" ? "rotate-0 scale-100" : "rotate-90 scale-0"}`} />
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}
