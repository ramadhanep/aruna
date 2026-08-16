"use client";

import { Suspense, useState, useMemo, useEffect, useRef, useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { ClearDataButton } from "@/components/clear-data-button";
import { useAuth } from "@/components/auth-provider";
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
  Languages,
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";

function getCookieLocale() {
  if (typeof document === "undefined") return "en";
  const match = document.cookie.match(/(?:^|;\s*)locale=([^;]+)/);
  return match ? match[1] : "en";
}

function AccountSidebarContent() {
  const t = useTranslations();
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
  const [locale, setLocale] = useState(getCookieLocale);
  const isClient = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  const activeThemeMode = isClient ? (theme === "dark" ? "dark" : "light") : null;
  const activeLocale = isClient ? locale : null;
  const redirectHandledRef = useRef(false);
  const rawRedirect = searchParams?.get("redirect") || null;
  const redirectParam = rawRedirect && rawRedirect.startsWith("/") ? rawRedirect : null;

  const handleSetLocale = (next) => {
    setLocale(next);
    document.cookie = `locale=${next};path=/;max-age=31536000;SameSite=Lax`;
    router.refresh();
  };
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
          ? t("accountSidebar.errSignIn")
          : t("accountSidebar.errProvider")
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
      setSignOutError(t("accountSidebar.errSignOut"));
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-7 pb-12">
        <section className="space-y-3">
          <p className="text-1xs font-semibold uppercase tracking-wide text-muted-foreground">{t("accountSidebar.profile")}</p>
          <div className="rounded-3xl bg-card border border-border/30 px-4 py-5 text-foreground">
            {isClient ? (
              <>
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
                      {user ? fullName : t("accountSidebar.guestMode")}
                    </p>
                    <p className="text-1xs text-foreground/80 dark:text-white/80 truncate">
                      {user ? primaryEmail : t("accountSidebar.signInToSync")}
                    </p>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2 text-1xs">
                  <div className="rounded-2xl  px-3 py-2">
                    <p className="uppercase tracking-wide text-foreground/60 dark:text-white/60">{t("accountSidebar.mode")}</p>
                    <p className="text-sm font-semibold text-foreground dark:text-white">{user ? t("accountSidebar.synced") : t("accountSidebar.guest")}</p>
                  </div>
                  <div className="rounded-2xl  px-3 py-2">
                    <p className="uppercase tracking-wide text-foreground/60 dark:text-white/60">{t("accountSidebar.server")}</p>
                    <p className="text-sm font-semibold text-foreground dark:text-white">
                      {supabaseConfigured ? t("accountSidebar.connected") : t("accountSidebar.offline")}
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
                      {t("accountSidebar.signInPrompt")}
                    </p>
                    <Button
                      type="button"
                      onClick={handleGoogleSignIn}
                      className="w-full justify-center gap-3 rounded-full bg-foreground text-[12px] font-semibold text-background hover:bg-foreground/90"
                    >
                      <GoogleGlyph />
                      <span>{t("accountSidebar.signInWithGoogle")}</span>
                    </Button>
                    {authError ? (
                      <div className="rounded-2xl bg-red-600/15 px-3 py-2 text-1xs text-red-100">
                        {authError}
                      </div>
                    ) : null}
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center gap-3">
                <Skeleton className="h-14 w-14 rounded-full" />
                <div className="min-w-0 space-y-1.5">
                  <Skeleton className="h-4 w-32 rounded-full" />
                  <Skeleton className="h-3 w-44 rounded-full" />
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="space-y-3">
          <p className="text-1xs font-semibold uppercase tracking-wide text-muted-foreground">{t("accountSidebar.appearance")}</p>
          <div className="rounded-3xl bg-card border border-border/30 px-4 py-4">
            <p className="text-1xs text-muted-foreground">
              {t("accountSidebar.appearanceHint")}
            </p>
            <div className="mt-3 flex gap-2">
              <Button
                type="button"
                variant={activeThemeMode === "light" ? "default" : "outline"}
                className="flex-1 justify-center gap-2 rounded-2xl text-xs"
                onClick={() => setTheme("light")}
              >
                <Sun className="h-4 w-4" />
                {t("accountSidebar.light")}
              </Button>
              <Button
                type="button"
                variant={activeThemeMode === "dark" ? "default" : "outline"}
                className="flex-1 justify-center gap-2 rounded-2xl text-xs"
                onClick={() => setTheme("dark")}
              >
                <Moon className="h-4 w-4" />
                {t("accountSidebar.dark")}
              </Button>
            </div>
            <div className="mt-3 flex items-center justify-between rounded-2xl border border-border/40 bg-muted/20 px-3 py-2.5">
              <div>
                <p className="text-xs font-medium">{t("accountSidebar.visualMode")}</p>
                <p className="text-1xs text-muted-foreground">{t("accountSidebar.visualModeHint")}</p>
              </div>
              <Button
                type="button"
                variant={mode === "pro" ? "default" : "outline"}
                className="min-w-[118px] justify-center gap-2 rounded-xl text-xs"
                onClick={() => setMode(mode === "lite" ? "pro" : "lite")}
              >
                {mode === "lite" ? t("accountSidebar.lite") : t("accountSidebar.pro")}
              </Button>
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <p className="text-1xs font-semibold uppercase tracking-wide text-muted-foreground">{t("accountSidebar.language")}</p>
          <div className="rounded-3xl bg-card border border-border/30 px-4 py-4">
            <p className="text-1xs text-muted-foreground">
              {t("accountSidebar.languageHint")}
            </p>
            <div className="mt-3 flex gap-2">
              <Button
                type="button"
                variant={activeLocale === "en" ? "default" : "outline"}
                className="flex-1 justify-center gap-2 rounded-2xl text-xs"
                onClick={() => handleSetLocale("en")}
              >
                <Languages className="h-4 w-4" />
                English
              </Button>
              <Button
                type="button"
                variant={activeLocale === "id" ? "default" : "outline"}
                className="flex-1 justify-center gap-2 rounded-2xl text-xs"
                onClick={() => handleSetLocale("id")}
              >
                <Languages className="h-4 w-4" />
                Bahasa Indonesia
              </Button>
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <p className="text-1xs font-semibold uppercase tracking-wide text-muted-foreground">{t("accountSidebar.dataPrivacy")}</p>
          <div className="rounded-3xl bg-card border border-border/30 px-4 py-4 space-y-4">
            <ClearDataButton
              onCleared={user ? clearRemoteData : undefined}
              trigger={
                <button
                  type="button"
                  className="flex w-full items-center justify-between rounded-2xl bg-black/1 dark:bg-white/1 px-3 py-3 text-left text-xs"
                >
                  <div>
                    <p className="font-semibold text-foreground">{t("accountSidebar.clearData")}</p>
                    <p className="text-1xs text-muted-foreground">
                      {t("accountSidebar.clearDataHint")}
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
                    {t("accountSidebar.signOut")}
                  </Button>
                </DialogTrigger>
                <DialogContent closeButtonPosition="right">
                  <DialogHeader>
                    <DialogTitle className="text-sm font-semibold">{t("accountSidebar.logOutTitle")}</DialogTitle>
                    <DialogDescription className="text-1xs text-muted-foreground">
                      {t("accountSidebar.logOutDesc")}
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
                        {t("common.cancel")}
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
                          {t("accountSidebar.loggingOut")}
                        </span>
                      ) : (
                        t("accountSidebar.logOut")
                      )}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            ) : null}
            {user && !supabaseConfigured ? (
              <div className="flex items-start gap-2 rounded-2xl bg-amber-500/10 px-3 py-3 text-1xs text-amber-800">
                <ShieldAlert className="h-4 w-4 flex-shrink-0" />
                {t("accountSidebar.providerWarning")}
              </div>
            ) : null}
          </div>
        </section>

        <section className="rounded-3xl bg-card border border-border/30 px-4 py-5 text-center">
          <p className="text-1xs text-muted-foreground">
            {t("accountSidebar.version", { version: process.env.NEXT_PUBLIC_APP_VERSION || "1.0.0" })}
          </p>
        </section>
      </div>
    </div>
  );
}

export function AccountSidebar({ open, onClose }) {
  const t = useTranslations();
  return (
    <Sheet open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <SheetContent
        side="left"
        className="w-full sm:max-w-3xl max-w-3xl border-r"
      >
        <SheetTitle className="sr-only">{t("accountSidebar.accountTitle")}</SheetTitle>
        <SheetDescription className="sr-only">{t("accountSidebar.accountDesc")}</SheetDescription>
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
          <AccountSidebarContent />
        </Suspense>
      </SheetContent>
    </Sheet>
  );
}
