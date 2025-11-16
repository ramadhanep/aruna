"use client";

import { useState, useMemo } from "react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ClearDataButton } from "@/components/clear-data-button";
import { useAuth } from "@/components/auth-provider";
import {
  Loader2,
  LogOut,
  Moon,
  Sun,
  UserRound,
  Trash2,
  ShieldAlert,
  Cookie,
  Heart,
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";

function GoogleGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6 1.54 7.38 2.83L35.9 8.8C32.86 6 28.82 4.5 24 4.5 15.54 4.5 7.9 9.54 4.8 17l6.86 5.33C12.8 15.56 17.93 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.5 24.5c0-1.6-.15-3.1-.45-4.5H24v8.55h12.65c-.55 3.07-2.23 5.68-4.81 7.43l7.32 5.67c4.3-3.96 7.34-9.88 7.34-17.15z"
      />
      <path
        fill="#FBBC05"
        d="M11.66 28.18A14.47 14.47 0 0 1 11 24c0-1.46.24-2.87.65-4.18l-6.85-5.32A23.4 23.4 0 0 0 1 24c0 3.76.9 7.3 2.47 10.47l8.19-6.29z"
      />
      <path
        fill="#34A853"
        d="M24 46c6.48 0 11.91-2.1 15.85-5.75l-7.32-5.67c-2.02 1.39-4.62 2.22-8.53 2.22-6.54 0-12.09-4.32-14.07-10.35l-8.19 6.3C5.94 40.82 14.27 46 24 46z"
      />
    </svg>
  );
}

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

export default function AccountPage() {
  const {
    user,
    loading,
    signInWithGoogle,
    signOut,
    clearRemoteData,
    deleteAccount,
    supabaseConfigured,
  } = useAuth();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [authError, setAuthError] = useState(null);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState(null);
  const isDark = theme === "dark" || resolvedTheme === "dark";

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

  const handleGoogleSignIn = async () => {
    setAuthError(null);
    try {
      await signInWithGoogle();
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
    <div className="space-y-6 pb-24">
      <section className="space-y-2">
        <p className="text-sm font-semibold text-muted-foreground">Profile overview</p>
        <Card className="border-none bg-gradient-to-br from-[#0f172a] via-[#111827] to-[#020617] text-white shadow-lg">
          <CardContent className="space-y-5 p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/15 text-sm font-semibold uppercase">
                <UserRound className="h-6 w-6 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold">
                  {user ? fullName : "You're browsing in guest mode"}
                </p>
                <p className="text-xs text-white/80 truncate">
                  {user
                    ? primaryEmail
                    : "Sign in to sync your watchlist and portfolio"}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-white">
              <div className="rounded-xl bg-white/10 p-3">
                <p className="text-xs uppercase tracking-wide text-white/70">Mode</p>
                <p className="text-sm font-semibold">{user ? "Synced" : "Guest"}</p>
              </div>
              <div className="rounded-xl bg-white/10 p-3">
                <p className="text-xs uppercase tracking-wide text-white/70">Server</p>
                <p className="text-sm font-semibold">
                  {supabaseConfigured ? "Connected" : "Offline"}
                </p>
              </div>
            </div>
            {loading ? (
              <div className="flex items-center justify-center py-2">
                <Loader2 className="h-5 w-5 animate-spin text-white/70" />
              </div>
            ) : user ? null : (
              <div className="space-y-3 rounded-xl border border-white/15 bg-white/5 p-4">
                <p className="text-xs text-white/80">
                  Sign in with Google to sync your watchlist and portfolio securely.
                </p>
                <Button
                  type="button"
                  onClick={handleGoogleSignIn}
                  className="w-full justify-center gap-3 rounded-full border border-white/40 bg-white text-[13px] font-semibold text-[#3c4043] shadow-sm hover:bg-white/90"
                >
                  <GoogleGlyph />
                  <span>Sign in with Google</span>
                </Button>
                {authError ? (
                  <div className="rounded-xl border border-red-600/40 bg-red-600/10 p-3 text-xs text-red-200">
                    {authError}
                  </div>
                ) : null}
              </div>
            )}
          </CardContent>
        </Card>
      </section>
      <section className="space-y-2">
        <p className="text-sm font-semibold">Appearance</p>
        <Card>
          <CardContent className="space-y-4 py-4">
            <p className="text-xs text-muted-foreground">
              Pick the look that feels best on your device. Light stays bright, dark saves battery.
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={isDark ? "outline" : "default"}
                className={`flex-1 justify-center gap-2 rounded-xl text-xs ${
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
                className={`flex-1 justify-center gap-2 rounded-xl text-xs ${
                  isDark ? "bg-primary text-primary-foreground" : ""
                }`}
                onClick={() => setTheme("dark")}
              >
                <Moon className="h-4 w-4" />
                Dark
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-2">
        <p className="text-sm font-semibold">Data & privacy</p>
        <Card>
          <CardContent className="space-y-4 py-4">
            <ClearDataButton
              onCleared={user ? clearRemoteData : undefined}
              trigger={
                <button
                  type="button"
                  className="flex w-full items-center justify-between rounded-xl border border-border px-3 py-3 text-left"
                >
                  <div>
                    <p className="text-sm font-semibold">Reset data</p>
                    <p className="text-xs text-muted-foreground">
                      Resest watchlist & portfolio to default.
                    </p>
                  </div>
                  <Cookie className="h-4 w-4 text-muted-foreground" />
                </button>
              }
            />
            {/* <div className="flex justify-center">
              {user ? (
              <DeleteAccountAction
                onConfirm={deleteAccount}
                disabled={!supabaseConfigured}
              />
            ) : null}
            </div> */}
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
                    className="w-full justify-center gap-2 rounded-xl text-xs"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign out
                  </Button>
                </DialogTrigger>
                <DialogContent closeButtonPosition="right">
                  <DialogHeader>
                    <DialogTitle className="text-sm font-semibold">Log out?</DialogTitle>
                    <DialogDescription className="text-xs text-muted-foreground">
                      We&apos;ll sign you out of this device. You can sign back in anytime to sync your data again.
                    </DialogDescription>
                  </DialogHeader>
                  {signOutError ? (
                    <div className="rounded-md border border-red-600/60 bg-red-600/10 px-3 py-2 text-xs text-red-600">
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
              <div className="flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-700">
                <ShieldAlert className="h-4 w-4 flex-shrink-0" />
                Provider credentials are not configured. Remote sync will be disabled until you add them.
              </div>
            ) : null}
          </CardContent>
        </Card>
      </section>

      <section>
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-6 text-center">
            <p className="text-[11px] text-muted-foreground">
              Version {process.env.NEXT_PUBLIC_APP_VERSION || "1.0.0"}
            </p>
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <span>Made with</span>
              <Heart className="h-4 w-4 fill-white" />
              <span>by Ramadhan Edy from 🇮🇩</span>
            </div>
            <p className="text-[11px] text-muted-foreground"><a href="https://trakteer.id/romadhan2" target="_blank" className="text-emerald-700">https://trakteer.id/romadhan2</a></p>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
