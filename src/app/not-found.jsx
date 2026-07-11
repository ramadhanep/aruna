import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] gap-6 text-center px-4">
      <div className="relative">
        <div className="text-[120px] lg:text-[160px] font-black leading-none tracking-tighter text-foreground/20 select-none">
          404
        </div>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="p-4 rounded-2xl bg-primary/10">
            <img src="/aruna.png" alt="aruna" className="size-8" />
          </div>
        </div>
      </div>
      
      <div className="space-y-2 max-w-sm">
        <h1 className="text-xl font-bold">Page not found</h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Looks like this page took a different route. Let&apos;s get you back to exploring the markets.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground text-sm font-semibold rounded-full hover:opacity-90 transition-opacity"
        >
          Back to Explore
        </Link>
        <Link
          href="/chart"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-muted text-foreground text-sm font-medium rounded-full hover:bg-muted/80 transition-colors"
        >
          Open Charts
        </Link>
      </div>
    </div>
  );
}
