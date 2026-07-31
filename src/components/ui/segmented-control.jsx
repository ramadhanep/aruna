"use client";

import { cn } from "@/lib/utils";

const sizeClasses = {
  xs: "px-2 py-0.5 text-2xs",
  sm: "px-2.5 py-1 text-xs",
  lg: "px-4 py-2 text-xs",
};

export function SegmentedControl({ value, onValueChange, options, size = "sm", shell = false, className }) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1",
        shell && "rounded-full border bg-muted/40 p-0.5",
        className
      )}
    >
      {options.map((option) => {
        const active = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            disabled={option.disabled}
            aria-pressed={active}
            onClick={() => onValueChange(option.value)}
            className={cn(
              "rounded-full font-semibold transition-colors",
              sizeClasses[size],
              active
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
              option.disabled && "pointer-events-none opacity-40"
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
