"use client";

import { useState, useMemo } from "react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
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
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#EA4335" d="M12 10.2v3.9h5.4c-.2 1.3-.6 2.2-1.3 2.9-.8.8-1.8 1.4-3.1 1.4-1.9 0-3.5-1.3-4.1-3-.2-.4-.3-1-.3-1.5 0-.5.1-1.1.3-1.5.6-1.7 2.2-3 4.1-3 1.1 0 1.9.4 2.6.9l2.6-2.6C17.3 6 15.1 5 12.9 5 9.6 5 6.6 6.9 5.4 9.8c-.4.9-.7 1.9-.7 3s.2 2.1.7 3c1.2 2.9 4.2 4.8 7.5 4.8 2.2 0 4.2-.7 5.6-2.2 1.5-1.4 2.4-3.5 2.4-6.4 0-.6-.1-1.3-.2-1.9H12z" />
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
          variant="outline"
          disabled={disabled}
          className="w-full justify-between items-center border-red-500/40 text-red-600 hover:bg-red-500/10 h-14"
        >
          <div className="flex flex-col items-start gap-1">
            <span className="text-sm font-semibold">Delete your account</span>
            <span className="text-xs text-red-500">
              Remove synced data and your account
            </span>
          </div>
          <Trash2 className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent closeButtonPosition="right">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold">Delete account?</DialogTitle>
          <DialogDescription className="text-xs">
            This removes your profile, cloud watchlist, and portfolio. You will be signed
            out and this action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        {error ? (
          <div className="rounded-md border border-red-500/60 bg-red-500/10 px-3 py-2 text-xs text-red-600">
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

  const initials = useMemo(() => {
    if (!fullName) return "U";
    const segments = fullName.trim().split(/\s+/);
    if (segments.length === 1) {
      return segments[0].slice(0, 2).toUpperCase();
    }
    return `${segments[0][0]}${segments[segments.length - 1][0]}`.toUpperCase();
  }, [fullName]);

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
    try {
      await signOut();
    } catch (error) {
      console.error("Failed to sign out", error);
    }
  };

  return (
    <div className="flex flex-col gap-6 pb-10">
      <section className="space-y-3">
        <h1 className="text-sm font-semibold">Account</h1>
        <Card>
          <CardContent className="pt-4">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : user ? (
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold uppercase text-primary">
                    {initials}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{fullName}</p>
                    {primaryEmail ? (
                      <p className="text-xs text-muted-foreground truncate">{primaryEmail}</p>
                    ) : null}
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-center gap-2 text-xs"
                    onClick={handleSignOut}
                  >
                    <LogOut className="h-4 w-4" />
                    Sign out
                  </Button>
                  {!supabaseConfigured ? (
                    <div className="flex items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-600">
                      <ShieldAlert className="h-4 w-4 flex-shrink-0" />
                      Provider credentials are not configured. Remote sync will be disabled until
                      you add them.
                    </div>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                    <UserRound className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold">You&apos;re in guest mode</p>
                    <p className="text-xs text-muted-foreground">
                      Sign in to sync your watchlist and portfolio across devices.
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  onClick={handleGoogleSignIn}
                  className="w-full justify-center gap-2 bg-white text-black hover:bg-white/90 text-xs"
                >
                  <GoogleGlyph />
                  Sign in with Google
                </Button>
                {authError ? (
                  <div className="rounded-md border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-600">
                    {authError}
                  </div>
                ) : null}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Appearance</h2>
        <Card>
          <CardContent className="flex flex-col items-center gap-6 py-6">
            <div className="text-center">
              <Label className="text-sm font-semibold">Theme</Label>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Sun className="h-5 w-5" />
                <span className="text-sm font-medium">Light</span>
              </div>
              <button
                type="button"
                onClick={() => setTheme(isDark ? "light" : "dark")}
                className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
                  isDark ? "bg-emerald-600" : "bg-gray-200"
                }`}
              >
                <span
                  className={`inline-block h-6 w-6 transform rounded-full transition-transform ${
                    isDark ? "translate-x-7 bg-white" : "translate-x-1 bg-black"
                  }`}
                />
              </button>
              <div className="flex items-center gap-2">
                <Moon className="h-5 w-5" />
                <span className="text-sm font-medium">Dark</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Data & Privacy</h2>
        <Card>
          <CardContent className="space-y-3 pt-4">
            <ClearDataButton
              onCleared={user ? clearRemoteData : undefined}
              trigger={
                <Button
                  type="button"
                  variant="outline"
                  className="w-full items-center justify-between gap-3 text-left h-14"
                >
                  <div className="flex flex-col items-start gap-1">
                    <span className="text-sm font-semibold">Reset data</span>
                    <span className="text-xs text-muted-foreground">
                      Clear watchlist and portfolio on this device
                    </span>
                  </div>
                  <Cookie className="h-4 w-4 text-muted-foreground" />
                </Button>
              }
            />
            <DeleteAccountAction
              onConfirm={deleteAccount}
              disabled={!user || !supabaseConfigured}
            />
          </CardContent>
        </Card>
      </section>

      <section>
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-6 text-center">
            <p className="text-xs text-muted-foreground">
              Version {process.env.NEXT_PUBLIC_APP_VERSION || "1.0.0"}
            </p>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <span>Made with</span>
              <Heart className="h-4 w-4 fill-white" />
              <span>by Ramadhan Edy from 🇮🇩</span>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
