"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const DEFAULT_ACTIVE_CLASS = "bg-primary text-primary-foreground hover:bg-primary/90";
const DEFAULT_INACTIVE_CLASS = "text-muted-foreground hover:bg-muted/60 hover:text-foreground";

/**
 * Behavior-focused segmented control: maps options onto `Button`s, owns the
 * selection state, and exposes it accessibly via `aria-pressed`. Visual
 * recipes are passed through to `Button` (variant/size/className per state)
 * so each feature keeps its own look — no shared visual style is forced.
 */
export function SegmentedControl({
  value,
  onValueChange,
  options,
  variant,
  size,
  className,
  activeClassName = DEFAULT_ACTIVE_CLASS,
  inactiveClassName = DEFAULT_INACTIVE_CLASS,
}) {
  return (
    <>
      {options.map((option) => {
        const active = value === option.value;
        return (
          <Button
            key={option.value}
            type="button"
            variant={variant}
            size={size}
            disabled={option.disabled}
            aria-pressed={active}
            onClick={() => onValueChange(option.value)}
            className={cn(className, active ? activeClassName : inactiveClassName)}
          >
            {option.label}
          </Button>
        );
      })}
    </>
  );
}
