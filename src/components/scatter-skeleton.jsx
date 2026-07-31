"use client";

export function ScatterSkeleton() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-6 max-w-3xl px-10 opacity-60 animate-pulse">
      {Array.from({ length: 24 }).map((_, i) => {
        const size = 40 + (i % 5) * 14;
        return (
          <div
            key={i}
            className="rounded-full bg-white/[0.07]"
            style={{ width: size, height: size }}
          />
        );
      })}
    </div>
  );
}
