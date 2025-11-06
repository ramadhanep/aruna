export default function Offline() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
      <h1 className="text-2xl font-bold">You are offline</h1>
      <p className="text-muted-foreground">
        Please check your internet connection and try again.
      </p>
    </div>
  );
}
