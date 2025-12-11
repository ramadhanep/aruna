"use client";

import { Suspense, useState, useMemo, useEffect, useRef } from "react";
import { useTheme } from "next-themes";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ClearDataButton } from "@/components/clear-data-button";
import { useAuth } from "@/components/auth-provider";
import { GoogleGlyph } from "@/components/google-glyph";
import {
  Loader2,
  LogOut,
  Moon,
  Sun,
  UserRound,
  ShieldAlert,
  Cookie,
  Heart,
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";

function DeleteAccountAction({ onConfirm, disabled }) {
  const [open, setOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);

  const handleConfirm = async () => {
    setIsProcessing(true);
    setError(null);
    try {
      await onConfirm();
      setOpen(false);
    } catch (err) {
      setError(err?.message ?? "Failed to delete account.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          disabled={disabled}
          className="p-0"
        >
          <div className="flex flex-1 flex-col items-start gap-0.5 text-xs text-red-600">
            Delete your Account
          </div>
        </Button>
      </DialogTrigger>
      <DialogContent closeButtonPosition="right">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold">
            Delete account?
          </DialogTitle>
          <DialogDescription className="text-xs leading-relaxed text-muted-foreground">
            We&apos;ll permanently remove every trace of your account from our databases.
            Don&apos;t worry—your data stays private; even our developers won&apos;t know you were ever here.
          </DialogDescription>
        </DialogHeader>
        {error ? (
          <div className="rounded-md border border-red-600/60 bg-red-600/10 px-3 py-2 text-xs text-red-600">
            {error}
          </div>
        ) : null}
        <DialogFooter className="gap-2">
          <DialogClose asChild>
            <Button variant="outline" className="text-xs">
              Cancel
            </Button>
          </DialogClose>
          <Button
            variant="destructive"
            className="text-xs"
            disabled={isProcessing}
            onClick={handleConfirm}
          >
            {isProcessing ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Deleting…
              </span>
            ) : (
              "Delete permanently"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AccountContent() {
  const {
    user,
    loading,
    signInWithGoogle,
    signOut,
    clearRemoteData,
    deleteAccount,
    supabaseConfigured,
  } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [authError, setAuthError] = useState(null);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState(null);
  const isDark = theme === "dark" || resolvedTheme === "dark";
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
    <div className="space-y-7 pb-24">
      <section className="space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Profile</p>
        <div className="rounded-3xl bg-gradient-to-br from-[#0f172a] via-[#111827] to-[#020617] px-4 py-5 text-white shadow-[0_10px_30px_rgba(0,0,0,0.45)]">
          <div className="flex items-center gap-3">
            <div className="h-14 w-14 overflow-hidden rounded-full border border-white/20 bg-white/10">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={fullName || "User avatar"}
                  className="h-full w-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs text-white/80">
                  <UserRound className="h-5 w-5" />
                </div>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold">
                {user ? fullName : "You're browsing in guest mode"}
              </p>
              <p className="text-[11px] text-white/80 truncate">
                {user ? primaryEmail : "Sign in to sync watchlist & portfolio"}
              </p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 text-[11px]">
            <div className="rounded-2xl bg-white/10 px-3 py-2">
              <p className="uppercase tracking-wide text-white/60">Mode</p>
              <p className="text-sm font-semibold text-white">{user ? "Synced" : "Guest"}</p>
            </div>
            <div className="rounded-2xl bg-white/10 px-3 py-2">
              <p className="uppercase tracking-wide text-white/60">Server</p>
              <p className="text-sm font-semibold text-white">
                {supabaseConfigured ? "Connected" : "Offline"}
              </p>
            </div>
          </div>
          {loading ? (
            <div className="mt-4 flex items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-white/70" />
            </div>
          ) : user ? null : (
            <div className="mt-4 space-y-3 rounded-2xl bg-white/5 px-4 py-4">
              <p className="text-[11px] text-white/80">
                Sign in with Google to sync your watchlist and portfolio securely.
              </p>
              <Button
                type="button"
                onClick={handleGoogleSignIn}
                className="w-full justify-center gap-3 rounded-full bg-white text-[12px] font-semibold text-[#3c4043] shadow-sm hover:bg-white/90"
              >
                <GoogleGlyph />
                <span>Sign in with Google</span>
              </Button>
              {authError ? (
                <div className="rounded-2xl bg-red-600/15 px-3 py-2 text-[11px] text-red-100">
                  {authError}
                </div>
              ) : null}
            </div>
          )}
        </div>
      </section>

      <section className="space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Appearance</p>
        <div className="rounded-3xl bg-muted/30 px-4 py-4">
          <p className="text-[11px] text-muted-foreground">
            Pick the look that feels best on your device. Light stays bright, dark saves battery.
          </p>
          <div className="mt-3 flex gap-2">
            <Button
              type="button"
              variant={isDark ? "outline" : "default"}
              className={`flex-1 justify-center gap-2 rounded-2xl text-xs ${
                !isDark ? "bg-primary text-primary-foreground" : ""
              }`}
              onClick={() => setTheme("light")}
            >
              <Sun className="h-4 w-4" />
              Light
            </Button>
            <Button
              type="button"
              variant={isDark ? "default" : "outline"}
              className={`flex-1 justify-center gap-2 rounded-2xl text-xs ${
                isDark ? "bg-primary text-primary-foreground" : ""
              }`}
              onClick={() => setTheme("dark")}
            >
              <Moon className="h-4 w-4" />
              Dark
            </Button>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Data & Privacy</p>
        <div className="rounded-3xl bg-muted/30 px-4 py-4 space-y-4">
          <ClearDataButton
            onCleared={user ? clearRemoteData : undefined}
            trigger={
              <button
                type="button"
                className="flex w-full items-center justify-between rounded-2xl bg-background/80 px-3 py-3 text-left text-xs shadow-[0_1px_10px_rgba(0,0,0,0.04)]"
              >
                <div>
                  <p className="font-semibold text-foreground">Clear Data</p>
                  <p className="text-[11px] text-muted-foreground">
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
                  <DialogDescription className="text-[11px] text-muted-foreground">
                    We&apos;ll sign you out of this device. You can sign back in anytime to sync your data again.
                  </DialogDescription>
                </DialogHeader>
                {signOutError ? (
                  <div className="rounded-md bg-red-600/15 px-3 py-2 text-[11px] text-red-600">
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
            <div className="flex items-start gap-2 rounded-2xl bg-amber-500/10 px-3 py-3 text-[11px] text-amber-800">
              <ShieldAlert className="h-4 w-4 flex-shrink-0" />
              Provider credentials are not configured. Remote sync will be disabled until you add them.
            </div>
          ) : null}
        </div>
      </section>

      <section className="rounded-3xl bg-background/80 px-4 py-5 text-center">
        <p className="text-[11px] text-muted-foreground">
          Version {process.env.NEXT_PUBLIC_APP_VERSION || "1.0.0"}
        </p>
        <div className="mt-2 flex items-center justify-center gap-1 text-[11px] text-muted-foreground">
          <span>Made with</span>
          <Heart className="h-4 w-4 fill-red-600 text-red-600 dark:fill-white dark:text-white" />
          <span>by Ramadhan Edy from 🇮🇩</span>
        </div>
      </section>
    </div>
  );
}

export default function AccountPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <AccountContent />
    </Suspense>
  );
}
