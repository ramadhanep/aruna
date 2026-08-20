"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GoogleGlyph } from "@/components/google-glyph";
import { useAuth } from "@/components/auth-provider";
import { getAuthErrorKey } from "@/lib/auth-errors";
import { Loader2 } from "lucide-react";

function ErrorBanner({ message }) {
  return (
    <div className="rounded-2xl bg-red-600/15 px-3 py-2.5 text-1xs text-red-600 dark:text-red-200">
      {message}
    </div>
  );
}

function InfoBanner({ message }) {
  return (
    <div className="rounded-2xl bg-blue-600/10 px-3 py-2.5 text-1xs text-blue-700 dark:text-blue-200">
      {message}
    </div>
  );
}

export function EmailPasswordForm() {
  const t = useTranslations("signin");
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    loading,
    supabaseConfigured,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    resetPasswordForEmail,
    updatePassword,
    recoveryActive,
  } = useAuth();

  const isRecovery = searchParams?.get("recovery") === "1";
  const rawRedirect = searchParams?.get("redirect") || "/";
  const redirectTarget = rawRedirect.startsWith("/") ? rawRedirect : "/";

  const [mode, setMode] = useState(isRecovery ? "reset" : "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [resetDone, setResetDone] = useState(false);

  const run = async (fn) => {
    setError(null);
    setInfo(null);
    setProcessing(true);
    try {
      await fn();
    } catch (err) {
      console.error("Auth action failed", err);
      setError(t(getAuthErrorKey(err) ?? "generic"));
    } finally {
      setProcessing(false);
    }
  };

  const handleGoogle = async () => {
    setError(null);
    setInfo(null);
    setProcessing(true);
    try {
      const returnPath = `/account?redirect=${encodeURIComponent(redirectTarget)}`;
      await signInWithGoogle(returnPath);
    } catch (err) {
      console.error("Failed to start Google sign-in", err);
      setError(supabaseConfigured ? t("errSignIn") : t("errProvider"));
    } finally {
      setProcessing(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (mode !== "reset" && !email.trim()) {
      setError(t("emailRequired"));
      return;
    }

    if ((mode === "signin" || mode === "signup") && !password) {
      setError(t("passwordRequired"));
      return;
    }

    if (mode === "reset" && password.length < 6) {
      setError(t("passwordTooShort"));
      return;
    }

    if (mode === "reset" && password !== confirmPassword) {
      setError(t("passwordsDontMatch"));
      return;
    }

    await run(async () => {
      if (mode === "signin") {
        await signInWithEmail(email.trim(), password);
      } else if (mode === "signup") {
        const data = await signUpWithEmail(email.trim(), password);
        if (!data?.session) {
          setInfo(t("checkConfirmedEmail", { email: email.trim() }));
        }
      } else if (mode === "forgot") {
        await resetPasswordForEmail(email.trim());
        setInfo(t("resetSent", { email: email.trim() }));
      } else if (mode === "reset") {
        await updatePassword(password);
        setResetDone(true);
        setInfo(t("passwordUpdated"));
      }
    });
  };

  const switchMode = (next) => {
    setMode(next);
    setError(null);
    setInfo(null);
    setPassword("");
    setConfirmPassword("");
  };

  const renderResetForm = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      );
    }

    if (isRecovery && !recoveryActive) {
      return (
        <div className="space-y-3">
          <ErrorBanner message={t("linkExpired")} />
          <Button
            type="button"
            variant="outline"
            className="w-full rounded-full text-xs"
            onClick={() => switchMode("signin")}
          >
            {t("backToSignIn")}
          </Button>
        </div>
      );
    }

    if (resetDone) {
      return (
        <div className="space-y-3">
          <InfoBanner message={info} />
          <Button
            type="button"
            className="w-full rounded-full bg-foreground text-xs font-semibold text-background hover:bg-foreground/95 h-11"
            onClick={() => router.replace(redirectTarget)}
          >
            {t("continue")}
          </Button>
        </div>
      );
    }

    return (
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="new-password">{t("newPassword")}</Label>
          <Input
            id="new-password"
            type="password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError(null); }}
            required
            minLength={6}
            autoComplete="new-password"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirm-password">{t("confirmPassword")}</Label>
          <Input
            id="confirm-password"
            type="password"
            value={confirmPassword}
            onChange={(e) => { setConfirmPassword(e.target.value); setError(null); }}
            required
            minLength={6}
            autoComplete="new-password"
          />
        </div>
        <Button
          type="submit"
          className="w-full rounded-full bg-foreground text-xs font-semibold text-background hover:bg-foreground/95 h-11"
          disabled={processing || !supabaseConfigured}
        >
          {processing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            t("updatePassword")
          )}
        </Button>
      </form>
    );
  };

  return (
    <div className="space-y-3">
      {mode === "reset" ? (
        renderResetForm()
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === "forgot" ? (
            <p className="text-1xs text-muted-foreground leading-relaxed">
              {t("forgotHint")}
            </p>
          ) : null}

          {mode !== "forgot" ? (
            <div className="space-y-1.5">
              <Label htmlFor="email">{t("emailLabel")}</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(null); }}
                placeholder={t("emailPlaceholder")}
                required
                autoComplete="email"
                autoCapitalize="none"
                autoCorrect="off"
              />
            </div>
          ) : null}

          {mode === "forgot" ? (
            <div className="space-y-1.5">
              <Label htmlFor="forgot-email">{t("emailLabel")}</Label>
              <Input
                id="forgot-email"
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(null); }}
                placeholder={t("emailPlaceholder")}
                required
                autoComplete="email"
                autoCapitalize="none"
                autoCorrect="off"
              />
            </div>
          ) : null}

          {mode === "signin" || mode === "signup" ? (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">{t("passwordLabel")}</Label>
                {mode === "signin" ? (
                  <button
                    type="button"
                    onClick={() => switchMode("forgot")}
                    className="text-1xs text-muted-foreground hover:text-foreground"
                  >
                    {t("forgotPassword")}
                  </button>
                ) : null}
              </div>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(null); }}
                required
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
              />
            </div>
          ) : null}

          {mode === "signup" ? (
            <div className="space-y-1.5">
              <Label htmlFor="confirm-password">{t("confirmPassword")}</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => { setConfirmPassword(e.target.value); setError(null); }}
                required
                autoComplete="new-password"
              />
            </div>
          ) : null}

          {mode === "signup" && password && password.length < 6 ? (
            <p className="text-1xs text-muted-foreground">
              {t("passwordHint")}
            </p>
          ) : null}

          <Button
            type="submit"
            className="w-full rounded-full bg-foreground text-xs font-semibold text-background hover:bg-foreground/95 h-11"
            disabled={processing || !supabaseConfigured}
          >
            {processing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : mode === "signin" ? (
              t("signIn")
            ) : mode === "signup" ? (
              t("signUp")
            ) : (
              t("sendResetLink")
            )}
          </Button>

          {error ? <ErrorBanner message={error} /> : null}
          {info ? <InfoBanner message={info} /> : null}

          {mode === "signin" ? (
            <p className="text-center text-1xs text-muted-foreground">
              {t("noAccount")}{" "}
              <button
                type="button"
                onClick={() => switchMode("signup")}
                className="font-semibold text-foreground underline underline-offset-4"
              >
                {t("signUp")}
              </button>
            </p>
          ) : (
            <p className="text-center text-1xs text-muted-foreground">
              {t("haveAccount")}{" "}
              <button
                type="button"
                onClick={() => switchMode("signin")}
                className="font-semibold text-foreground underline underline-offset-4"
              >
                {t("signIn")}
              </button>
            </p>
          )}
        </form>
      )}

      {mode !== "reset" ? (
        <>
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-1xs text-muted-foreground">{t("orContinue")}</span>
            <div className="h-px flex-1 bg-border" />
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={handleGoogle}
            disabled={processing || !supabaseConfigured}
            className="w-full justify-center gap-3 rounded-full text-xs font-semibold h-11 border-border text-foreground hover:bg-muted/50"
          >
            <GoogleGlyph />
            {t("signInWithGoogle")}
          </Button>
        </>
      ) : null}
    </div>
  );
}