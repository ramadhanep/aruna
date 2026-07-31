"use client";

export default function Error({ error, reset }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] gap-6 text-center px-4">
      <div className="p-5 rounded-2xl bg-primary/10">
        <div className="text-3xl font-black leading-none tracking-tighter text-foreground/80">
          !
        </div>
      </div>

      <div className="space-y-2 max-w-sm">
        <h1 className="text-xl font-bold">Something went wrong</h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {error?.message || "An unexpected error occurred."}
        </p>
      </div>

      <button
        type="button"
        onClick={() => reset()}
        className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground text-sm font-semibold rounded-full hover:opacity-90 transition-opacity"
      >
        Try Again
      </button>
    </div>
  );
}
