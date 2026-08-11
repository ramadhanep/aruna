import { cn } from "@/lib/utils";

export function SectionHeader({ title, className, as: Comp = "div" }) {
  return (
    <Comp className={cn("py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider", className)}>
      {title}
    </Comp>
  );
}