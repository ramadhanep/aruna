export default function Offline() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
      <div className="rounded-3xl bg-card border border-border/40 p-8 space-y-3 max-w-sm mx-auto">
        <h1 className="text-xl font-bold">You are offline</h1>
        <p className="text-sm text-muted-foreground">
          Please check your internet connection and try again.
        </p>
      </div>
    </div>
  );
}
