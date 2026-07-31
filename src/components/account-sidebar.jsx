"use client";

import { Suspense, useState, useMemo, useEffect, useRef, useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { ClearDataButton } from "@/components/clear-data-button";
import { useAuth } from "@/components/auth-provider";
import { DURATION_CLASS } from "@/lib/motion";
import { useAppearanceMode } from "@/components/appearance-mode-provider";
import { GoogleGlyph } from "@/components/google-glyph";
import {
  Loader2,
  LogOut,
  Moon,
  Sun,
  UserRound,
  ShieldAlert,
  Cookie,
  X,
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";

function AccountSidebarContent({ onClose }) {
  const {
    user,
    loading,
    signInWithGoogle,
    signOut,
    clearRemoteData,
    supabaseConfigured,
  } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { theme, setTheme } = useTheme();
  const { mode, setMode } = useAppearanceMode();
  const [authError, setAuthError] = useState(null);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState(null);
  const isClient = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  const activeThemeMode = isClient ? (theme === "dark" ? "dark" : "light") : null;
  const redirectHandledRef = useRef(false);
  const rawRedirect = searchParams?.get("redirect") || null;
  const redirectParam = rawRedirect && rawRedirect.startsWith("/") ? rawRedirect : null;
  const avatarUrl = useMemo(() => {
    if (!user) return null;
    return (
      user.user_metadata?.avatar_url ||
      user.user_metadata?.avatar ||
      user.user_metadata?.picture ||
      null
    );
  }, [user]);

  const fullName = useMemo(() => {
    if (!user) return null;
    return (
      user.user_metadata?.full_name ??
      user.user_metadata?.name ??
      user.user_metadata?.display_name ??
      user.email
    );
  }, [user]);

  const primaryEmail = user?.email ?? user?.user_metadata?.email;

  useEffect(() => {
    if (user && redirectParam && !redirectHandledRef.current) {
      redirectHandledRef.current = true;
      router.replace(redirectParam);
    }
  }, [user, redirectParam, router]);

  const handleGoogleSignIn = async () => {
    setAuthError(null);
    try {
      const returnPath = redirectParam
        ? `/account?redirect=${encodeURIComponent(redirectParam)}`
        : "/account";
      await signInWithGoogle(returnPath);
    } catch (error) {
      console.error("Failed to start Google sign-in", error);
      setAuthError(
        supabaseConfigured
          ? "Unable to start Google sign-in. Please try again."
          : "Provider credentials are missing. Add them to your environment to enable sign-in."
      );
    }
  };

  const handleSignOut = async () => {
    setSignOutError(null);
    setSigningOut(true);
    try {
      await signOut();
      setShowSignOutConfirm(false);
    } catch (error) {
      console.error("Failed to sign out", error);
      setSignOutError("Failed to log out. Please try again.");
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Close Button */}
      <div className="flex items-center justify-end px-4 py-3">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={onClose}
        >
          <X className="size-5 text-muted-foreground" />
        </Button>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-7 pb-12">
        <section className="space-y-3">
          <p className="text-1xs font-semibold uppercase tracking-wide text-muted-foreground">Profile</p>
          <div className="rounded-3xl bg-card border border-border/30 px-4 py-5 text-foreground">
            <div className="flex items-center gap-3">
              <div className="h-14 w-14 overflow-hidden rounded-full border border-black/10 dark:border-white/20 ">
                {avatarUrl ? (
                  <Image
                    src={avatarUrl}
                    alt={fullName || "User avatar"}
                    width={56}
                    height={56}
                    className="h-full w-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs text-foreground/80 dark:text-white/80">
                    <UserRound className="h-5 w-5" />
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold">
                  {user ? fullName : "You're browsing in guest mode"}
                </p>
                <p className="text-1xs text-foreground/80 dark:text-white/80 truncate">
                  {user ? primaryEmail : "Sign in to sync watchlist & portfolio"}
                </p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 text-1xs">
              <div className="rounded-2xl  px-3 py-2">
                <p className="uppercase tracking-wide text-foreground/60 dark:text-white/60">Mode</p>
                <p className="text-sm font-semibold text-foreground dark:text-white">{user ? "Synced" : "Guest"}</p>
              </div>
              <div className="rounded-2xl  px-3 py-2">
                <p className="uppercase tracking-wide text-foreground/60 dark:text-white/60">Server</p>
                <p className="text-sm font-semibold text-foreground dark:text-white">
                  {isClient && supabaseConfigured ? "Connected" : "Offline"}
                </p>
              </div>
            </div>
            {loading ? (
              <div className="mt-4 flex items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-foreground/70 dark:text-white/70" />
              </div>
            ) : user ? null : (
              <div className="mt-4 space-y-3 rounded-2xl bg-black/1 dark:bg-white/1 px-4 py-4">
                <p className="text-1xs text-foreground/80 dark:text-white/80">
                  Sign in with Google to sync your watchlist and portfolio securely.
                </p>
                <Button
                  type="button"
                  onClick={handleGoogleSignIn}
                  className="w-full justify-center gap-3 rounded-full bg-foreground text-[12px] font-semibold text-background hover:bg-foreground/90"
                >
                  <GoogleGlyph />
                  <span>Sign in with Google</span>
                </Button>
                {authError ? (
                  <div className="rounded-2xl bg-red-600/15 px-3 py-2 text-1xs text-red-100">
                    {authError}
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </section>

        <section className="space-y-3">
          <p className="text-1xs font-semibold uppercase tracking-wide text-muted-foreground">Appearance</p>
          <div className="rounded-3xl bg-card border border-border/30 px-4 py-4">
            <p className="text-1xs text-muted-foreground">
              Pick the look that feels best on your device. Light stays bright, dark saves battery.
            </p>
            <div className="mt-3 flex gap-2">
              <Button
                type="button"
                variant={activeThemeMode === "light" ? "default" : "outline"}
                className="flex-1 justify-center gap-2 rounded-2xl text-xs"
                onClick={() => setTheme("light")}
              >
                <Sun className="h-4 w-4" />
                Light
              </Button>
              <Button
                type="button"
                variant={activeThemeMode === "dark" ? "default" : "outline"}
                className="flex-1 justify-center gap-2 rounded-2xl text-xs"
                onClick={() => setTheme("dark")}
              >
                <Moon className="h-4 w-4" />
                Dark
              </Button>
            </div>
            <div className="mt-3 flex items-center justify-between rounded-2xl border border-border/40 bg-muted/20 px-3 py-2.5">
              <div>
                <p className="text-xs font-medium">Visual Mode</p>
                <p className="text-1xs text-muted-foreground">Lite mode skips ticker logo images to keep it lighter.</p>
              </div>
              <Button
                type="button"
                variant={mode === "pro" ? "default" : "outline"}
                className="min-w-[118px] justify-center gap-2 rounded-xl text-xs"
                onClick={() => setMode(mode === "lite" ? "pro" : "lite")}
              >
                {mode === "lite" ? "Lite" : "Pro"}
              </Button>
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <p className="text-1xs font-semibold uppercase tracking-wide text-muted-foreground">Data & Privacy</p>
          <div className="rounded-3xl bg-card border border-border/30 px-4 py-4 space-y-4">
            <ClearDataButton
              onCleared={user ? clearRemoteData : undefined}
              trigger={
                <button
                  type="button"
                  className="flex w-full items-center justify-between rounded-2xl bg-black/1 dark:bg-white/1 px-3 py-3 text-left text-xs"
                >
                  <div>
                    <p className="font-semibold text-foreground">Clear Data</p>
                    <p className="text-1xs text-muted-foreground">
                      Remove watchlist & portfolio items from your account.
                    </p>
                  </div>
                  <Cookie className="h-4 w-4 text-muted-foreground" />
                </button>
              }
            />
            {user ? (
              <Dialog
                open={showSignOutConfirm}
                onOpenChange={(nextOpen) => {
                  if (!nextOpen && signingOut) return;
                  setShowSignOutConfirm(nextOpen);
                  if (!nextOpen) {
                    setSignOutError(null);
                  }
                }}
              >
                <DialogTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-center gap-2 rounded-2xl text-xs"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign out
                  </Button>
                </DialogTrigger>
                <DialogContent closeButtonPosition="right">
                  <DialogHeader>
                    <DialogTitle className="text-sm font-semibold">Log out?</DialogTitle>
                    <DialogDescription className="text-1xs text-muted-foreground">
                      We&apos;ll sign you out of this device. You can sign back in anytime to sync your data again.
                    </DialogDescription>
                  </DialogHeader>
                  {signOutError ? (
                    <div className="rounded-md bg-red-600/15 px-3 py-2 text-1xs text-red-600">
                      {signOutError}
                    </div>
                  ) : null}
                  <DialogFooter className="gap-2">
                    <DialogClose asChild>
                      <Button variant="outline" className="text-xs" disabled={signingOut}>
                        Cancel
                      </Button>
                    </DialogClose>
                    <Button
                      variant="destructive"
                      className="text-xs"
                      disabled={signingOut}
                      onClick={handleSignOut}
                    >
                      {signingOut ? (
                        <span className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Logging out…
                        </span>
                      ) : (
                        "Log out"
                      )}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            ) : null}
            {user && !supabaseConfigured ? (
              <div className="flex items-start gap-2 rounded-2xl bg-amber-500/10 px-3 py-3 text-1xs text-amber-800">
                <ShieldAlert className="h-4 w-4 flex-shrink-0" />
                Provider credentials are not configured. Remote sync will be disabled until you add them.
              </div>
            ) : null}
          </div>
        </section>

        <section className="rounded-3xl bg-card border border-border/30 px-4 py-5 text-center">
          <p className="text-1xs text-muted-foreground">
            Version {process.env.NEXT_PUBLIC_APP_VERSION || "1.0.0"}
          </p>
        </section>
      </div>
    </div>
  );
}

export function AccountSidebar({ open, onClose }) {
  return (
    <>
      <div
        className={`fixed inset-0 bg-black/50 z-[60] transition-opacity ${DURATION_CLASS.base} ${open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
          }`}
        onClick={onClose}
      />

      {/* Sidebar */}
      <div
        className={`fixed top-0 left-0 bottom-0 w-full max-w-3xl bg-background z-[70] transition-transform ${DURATION_CLASS.slow} ease-out ${open ? "translate-x-0 pointer-events-auto" : "-translate-x-full pointer-events-none"
          }`}
      >
        <Suspense
          fallback={
            <div className="p-4 space-y-3">
              <div className="flex items-center gap-3">
                <Skeleton className="h-9 w-9 rounded-full" />
                <div className="space-y-1.5">
                  <Skeleton className="h-3 w-28 rounded-full" />
                  <Skeleton className="h-3 w-20 rounded-full" />
                </div>
              </div>
              <Skeleton className="h-24 w-full rounded-2xl" />
              <Skeleton className="h-24 w-full rounded-2xl" />
              <Skeleton className="h-24 w-full rounded-2xl" />
            </div>
          }
        >
          <AccountSidebarContent onClose={onClose} />
        </Suspense>
      </div>
    </>
  );
}
