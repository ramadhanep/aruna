import { AlignEndHorizontal } from "lucide-react";

export function ArunaWatermark({ className = "", labelClassName = "" }) {
  const wrapperClass = [
    "pointer-events-none select-none text-muted-foreground/30",
    "opacity-70 mix-blend-multiply dark:mix-blend-screen",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const labelClasses = [
    "flex items-center gap-1 text-lg font-bold",
    labelClassName,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={wrapperClass} aria-hidden="true">
      <div className={labelClasses}>
        <div className="h-4 relative overflow-hidden">
          <AlignEndHorizontal className="size-5" />
        </div>
        <span>aruna</span>
      </div>
    </div>
  );
}
