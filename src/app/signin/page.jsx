"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/components/auth-provider";
import { GoogleGlyph } from "@/components/google-glyph";
import { Loader2, ShieldAlert } from "lucide-react";

export default function SignInPage() {
  const { signInWithGoogle, supabaseConfigured, user, loading } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [error, setError] = useState(null);
  const [processing, setProcessing] = useState(false);
  const rawRedirect = searchParams?.get("redirect") || "/";
  const redirectTarget = rawRedirect.startsWith("/") ? rawRedirect : "/";

  useEffect(() => {
    if (!loading && user) {
      router.replace(redirectTarget);
    }
  }, [loading, user, redirectTarget, router]);

  const handleSignIn = async () => {
    setError(null);
    setProcessing(true);
    try {
      const returnPath = `/account?redirect=${encodeURIComponent(redirectTarget)}`;
      await signInWithGoogle(returnPath);
    } catch (err) {
      console.error("Failed to start Google sign-in", err);
      setError(
        supabaseConfigured
          ? "Unable to start Google sign-in. Please try again."
          : "Provider credentials are missing. Add them to enable sign-in."
      );
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-15rem)]  flex-col justify-center gap-6">
      <Card>
        <CardContent className="space-y-6">
          <div>
            <h1 className="mt-2 text-base font-semibold">Sign in to continue</h1>
            <p className="mt-2 text-xs text-muted-foreground">
              Sync your watchlist and portfolio securely across every device.
            </p>
          </div>
          <div className="space-y-3">
            <Button
              type="button"
              onClick={handleSignIn}
              disabled={processing || !supabaseConfigured}
              className="w-full justify-center gap-3 rounded-full border border-white/30 bg-white text-xs font-semibold text-[#3c4043] shadow-sm hover:bg-white/90"
            >
              {processing ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Redirecting…
                </span>
              ) : (
                <>
                  <GoogleGlyph />
                  <span>Sign in with Google</span>
                </>
              )}
            </Button>
            {error ? (
              <div className="rounded-xl border border-red-600/40 bg-red-600/10 p-3 text-xs text-red-100">
                {error}
              </div>
            ) : null}
            {!supabaseConfigured ? (
              <div className="flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-100">
                <ShieldAlert className="h-4 w-4 flex-shrink-0" />
                Provider credentials are not configured. Remote sync will be disabled until you add them.
              </div>
            ) : null}
            <p className="text-[11px] text-muted-foreground">
              By continuing you agree to our use of Google for authentication. We only use your email to keep your data in sync.
            </p>
          </div>
        </CardContent>
      </Card>
      <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={() => router.back()}>
        Go back
      </Button>
    </div>
  );
}
