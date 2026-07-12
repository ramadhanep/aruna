"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";

export function ModeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Before mount, activeMode is undefined — render in a neutral "light" state
  // so the server HTML matches the initial client render.
  const activeMode = mounted ? (theme === "dark" ? "dark" : "light") : "light";

  const cycleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
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
