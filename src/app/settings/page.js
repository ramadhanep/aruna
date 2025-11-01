"use client";

import { useTheme } from "next-themes";
import { Label } from "@/components/ui/label";
import { Moon, Sun, Heart } from "lucide-react";

export default function SettingsPage() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const isDark = theme === "dark" || resolvedTheme === "dark";

  return (
    <div className="flex flex-col min-h-[calc(100vh-8rem)] justify-between items-center py-8">
      <div className="flex-1 flex flex-col items-center justify-center gap-6 w-full max-w-md px-4">
        <div className="text-center">
          <Label className="text-lg font-semibold">Theme</Label>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Sun className="h-5 w-5" />
            <span className="text-sm font-medium">Light</span>
          </div>
          
          <button
            onClick={() => setTheme(isDark ? "light" : "dark")}
            className={`relative inline-flex h-8 w-14 items-center rounded-full cursor-pointer transition-colors ${
              isDark ? "bg-blue-800" : "bg-gray-200"
            }`}
          >
            <span
              className={`inline-block h-6 w-6 transform rounded-full transition-transform ${
                isDark ? "translate-x-7 bg-white" : "translate-x-1 bg-black"
              }`}
            />
          </button>
          
          <div className="flex items-center gap-2">
            <Moon className="h-5 w-5" />
            <span className="text-sm font-medium">Dark</span>
          </div>
        </div>

        <div className="mt-12 flex flex-col w-full justify-center text-center gap-2">
            <p className="text-sm text-muted-foreground">
                Version {process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0'}
            </p>
            <div className="flex items-center justify-center gap-1 text-sm text-muted-foreground pb-4">
                <span>Made with</span>
                <Heart className="h-4 w-4 fill-white" />
                <span>by Ramadhan Edy from</span>
                <span className="text-base">🇮🇩</span>
            </div>
        </div>
      </div>
    </div>
  );
}
