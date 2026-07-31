

import Image from "next/image";

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
        <Image src="/aruna.png" alt="aruna" width={20} height={20} className="size-5 opacity-30" />
        <span>aruna</span>
      </div>
    </div>
  );
}
