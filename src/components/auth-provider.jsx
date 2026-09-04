"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { fetchEncodedJson } from "@/lib/api-client";
import { getDefaultWatchlist } from "@/lib/default-watchlist";
import { toast } from "sonner";

const AuthContext = createContext({
  supabase: null,
  user: null,
  session: null,
  loading: true,
  supabaseConfigured: false,
  signInWithGoogle: async () => {},
  signInWithEmail: async () => {},
  signUpWithEmail: async () => {},
  resetPasswordForEmail: async () => {},
  updatePassword: async () => {},
  recoveryActive: false,
  signOut: async () => {},
  deleteAccount: async () => {},
});

const DataContext = createContext({
  remoteWatchlist: null,
  remoteWatchlistUpdatedAt: null,
  watchlistLoaded: false,
  remotePortfolio: null,
  remotePortfolioUpdatedAt: null,
  portfolioLoaded: false,
  syncWatchlist: async () => null,
  syncPortfolio: async () => null,
  refreshRemoteWatchlist: async () => {},
  refreshRemotePortfolio: async () => {},
  clearRemoteData: async () => {},
});

export function AuthProvider({ children }) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const supabaseExists = Boolean(supabase);
  const [loading, setLoading] = useState(() => !supabaseExists);
  const [remoteWatchlist, setRemoteWatchlist] = useState(null);
  const [remoteWatchlistUpdatedAt, setRemoteWatchlistUpdatedAt] = useState(null);
  const [watchlistLoaded, setWatchlistLoaded] = useState(false);
  const [remotePortfolio, setRemotePortfolio] = useState(null);
  const [remotePortfolioUpdatedAt, setRemotePortfolioUpdatedAt] = useState(null);
  const [portfolioLoaded, setPortfolioLoaded] = useState(false);
  const [recoveryActive, setRecoveryActive] = useState(false);

  useEffect(() => {
    if (!supabase) return;

    let isMounted = true;

    // OAuth callback pages carry `?code=` (or an `error=`) before the session
    // exchange completes. Keep `loading` true until the session event arrives so
    // guards don't redirect before the session is available.
    const params = typeof window !== "undefined" ? window.location.search : "";
    const isOAuthCallback = /[?&](code|access_token)=/.test(params);
    const hasOAuthError = /[?&]error=/.test(params);
    const holdLoading = isOAuthCallback && !hasOAuthError;

    let callbackTimeout = null;
    if (holdLoading) {
      callbackTimeout = setTimeout(() => {
        if (isMounted) setLoading(false);
      }, 10000);
    }

    supabase.auth.getSession().then(({ data, error }) => {
      if (!isMounted) return;

      if (error) {
        console.warn("Failed to read Supabase session", error);
        setSession(null);
        setUser(null);
      } else {
        setSession(data?.session ?? null);
        setUser(data?.session?.user ?? null);
      }
      if (!holdLoading) {
        setLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!isMounted) return;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setRecoveryActive(event === "PASSWORD_RECOVERY");
      if (holdLoading && event !== "SIGNED_OUT") {
        setLoading(false);
        if (callbackTimeout) clearTimeout(callbackTimeout);
      }
    });

    return () => {
      isMounted = false;
      subscription?.unsubscribe();
      if (callbackTimeout) clearTimeout(callbackTimeout);
    };
  }, [supabase]);

  const ensureProfileUpsert = useCallback(async () => {
    if (!supabase || !user) return;

    const profileData = {
      id: user.id,
      email: user.email,
      full_name:
        user.user_metadata?.full_name ??
        user.user_metadata?.name ??
        user.user_metadata?.display_name ??
        null,
      avatar_url: user.user_metadata?.avatar_url ?? null,
      updated_at: new Date().toISOString(),
    };

    try {
      // Check if profile exists
      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", user.id)
        .maybeSingle();

      const isNewUser = !existingProfile;

      // Upsert profile
      await supabase.from("profiles").upsert(profileData, {
        onConflict: "id",
      });

      // If new user, post welcome message to discussion
      if (isNewUser) {
        const userName = profileData.full_name || profileData.email?.split('@')[0] || 'Someone';
        
        await supabase
          .from("discussion_messages")
          .insert({
            user_id: user.id,
            content: `${userName} joins Aruna`,
            is_system: false,
          });
      }
    } catch (error) {
      console.warn("Failed to upsert profile", error);
      toast.error('Failed to save profile');
    }
  }, [supabase, user]);

  useEffect(() => {
    if (!user) {
      queueMicrotask(() => {
        setRemoteWatchlist(null);
        setRemoteWatchlistUpdatedAt(null);
        setWatchlistLoaded(false);
        setRemotePortfolio(null);
        setRemotePortfolioUpdatedAt(null);
        setPortfolioLoaded(false);
      });
      return;
    }

    ensureProfileUpsert();
  }, [user, ensureProfileUpsert]);

  const refreshRemoteWatchlist = useCallback(async () => {
    if (!supabase || !user) {
      setWatchlistLoaded(true);
      return null;
    }

    setWatchlistLoaded(false);
    try {
      const { data, error } = await supabase
        .from("watchlists")
        .select("items, updated_at")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;

      setRemoteWatchlist(data?.items ?? null);
      setRemoteWatchlistUpdatedAt(data?.updated_at ?? null);
      return data?.items ?? null;
    } catch (error) {
      console.warn("Failed to load remote watchlist", error);
      toast.error('Failed to load watchlist');
      setRemoteWatchlist(null);
      setRemoteWatchlistUpdatedAt(null);
      return null;
    } finally {
      setWatchlistLoaded(true);
    }
  }, [supabase, user]);

  const refreshRemotePortfolio = useCallback(async () => {
    if (!supabase || !user) {
      setPortfolioLoaded(true);
      return null;
    }

    setPortfolioLoaded(false);
    try {
      const { data, error } = await supabase
        .from("portfolios")
        .select("entries, updated_at")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;

      setRemotePortfolio(data?.entries ?? null);
      setRemotePortfolioUpdatedAt(data?.updated_at ?? null);
      return data?.entries ?? null;
    } catch (error) {
      console.warn("Failed to load remote portfolio", error);
      toast.error('Failed to load portfolio');
      setRemotePortfolio(null);
      setRemotePortfolioUpdatedAt(null);
      return null;
    } finally {
      setPortfolioLoaded(true);
    }
  }, [supabase, user]);

  useEffect(() => {
    if (!user) return;
    setTimeout(() => {
      refreshRemoteWatchlist();
      refreshRemotePortfolio();
    }, 0);
  }, [user, refreshRemoteWatchlist, refreshRemotePortfolio]);

  const signInWithGoogle = useCallback(
    async (returnPath = "/account") => {
      if (!supabase) {
        throw new Error("Supabase is not configured");
      }
      const origin =
        typeof window !== "undefined" ? window.location.origin : null;
      const redirectTo = origin ? `${origin}${returnPath}` : undefined;

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
          queryParams: {
            access_type: "offline",
            prompt: "consent",
          },
        },
      });

      if (error) {
        throw error;
      }
    },
    [supabase]
  );

  const signInWithEmail = useCallback(
    async (email, password) => {
      if (!supabase) {
        throw new Error("Supabase is not configured");
      }
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    },
    [supabase]
  );

  const signUpWithEmail = useCallback(
    async (email, password) => {
      if (!supabase) {
        throw new Error("Supabase is not configured");
      }
      const origin =
        typeof window !== "undefined" ? window.location.origin : null;
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: origin ? `${origin}/account` : undefined,
        },
      });
      if (error) throw error;
      return data;
    },
    [supabase]
  );

  const resetPasswordForEmail = useCallback(
    async (email) => {
      if (!supabase) {
        throw new Error("Supabase is not configured");
      }
      const origin =
        typeof window !== "undefined" ? window.location.origin : null;
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: origin ? `${origin}/signin?recovery=1` : undefined,
      });
      if (error) throw error;
    },
    [supabase]
  );

  const updatePassword = useCallback(
    async (newPassword) => {
      if (!supabase) {
        throw new Error("Supabase is not configured");
      }
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
    },
    [supabase]
  );

  const signOut = useCallback(async () => {
    if (!supabase) return;
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.warn("Failed to sign out", error);
      toast.error('Failed to sign out');
    } finally {
      setRemoteWatchlist(null);
      setRemoteWatchlistUpdatedAt(null);
      setWatchlistLoaded(false);
      setRemotePortfolio(null);
      setRemotePortfolioUpdatedAt(null);
      setPortfolioLoaded(false);
    }
  }, [supabase]);

  const syncWatchlist = useCallback(
    async (items) => {
      if (!supabase || !user) return false;

      const payload = {
        user_id: user.id,
        items: items ?? [],
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from("watchlists").upsert(payload, {
        onConflict: "user_id",
      });

      if (error) {
        console.warn("Failed to sync watchlist", error);
        return null;
      }

      setRemoteWatchlist(payload.items);
      setRemoteWatchlistUpdatedAt(payload.updated_at);
      setWatchlistLoaded(true);
      return payload.updated_at;
    },
    [supabase, user]
  );

  const syncPortfolio = useCallback(
    async (entries) => {
      if (!supabase || !user) return false;

      const payload = {
        user_id: user.id,
        entries: entries ?? [],
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from("portfolios").upsert(payload, {
        onConflict: "user_id",
      });

      if (error) {
        console.warn("Failed to sync portfolio", error);
        return null;
      }

      setRemotePortfolio(payload.entries);
      setRemotePortfolioUpdatedAt(payload.updated_at);
      setPortfolioLoaded(true);
      return payload.updated_at;
    },
    [supabase, user]
  );

  const clearRemoteData = useCallback(async () => {
    if (!supabase || !user) return false;

    const timestamp = new Date().toISOString();

    const defaultWatchlist = getDefaultWatchlist();

    const { error: watchlistError } = await supabase
      .from("watchlists")
      .upsert(
        { user_id: user.id, items: defaultWatchlist, updated_at: timestamp },
        { onConflict: "user_id" }
      );

    if (watchlistError) {
      console.warn("Failed to clear remote watchlist", watchlistError);
      return false;
    }

    const { error: portfolioError } = await supabase
      .from("portfolios")
      .upsert(
        { user_id: user.id, entries: [], updated_at: timestamp },
        { onConflict: "user_id" }
      );

    if (portfolioError) {
      console.warn("Failed to clear remote portfolio", portfolioError);
      return false;
    }

    setRemoteWatchlist(defaultWatchlist);
    setRemoteWatchlistUpdatedAt(timestamp);
    setRemotePortfolio([]);
    setRemotePortfolioUpdatedAt(timestamp);
    return true;
  }, [supabase, user]);

  const deleteAccount = useCallback(async () => {
    const token = session?.access_token;
    if (!token) {
      throw new Error("No active session");
    }

    try {
      const { response, data } = await fetchEncodedJson("/api/delete-account", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(data?.error ?? "Failed to delete account");
      }

      await signOut();
    } catch (error) {
      console.warn("Failed to delete account", error);
      throw error;
    }
  }, [session, signOut]);

  const authValue = useMemo(
    () => ({
      supabase,
      user,
      session,
      loading,
      supabaseConfigured: Boolean(supabase),
      signInWithGoogle,
      signInWithEmail,
      signUpWithEmail,
      resetPasswordForEmail,
      updatePassword,
      recoveryActive,
      signOut,
      deleteAccount,
    }),
    [
      supabase,
      user,
      session,
      loading,
      signInWithGoogle,
      signInWithEmail,
      signUpWithEmail,
      resetPasswordForEmail,
      updatePassword,
      recoveryActive,
      signOut,
      deleteAccount,
    ]
  );

  const dataValue = useMemo(
    () => ({
      remoteWatchlist,
      remoteWatchlistUpdatedAt,
      watchlistLoaded,
      remotePortfolio,
      remotePortfolioUpdatedAt,
      portfolioLoaded,
      syncWatchlist,
      syncPortfolio,
      refreshRemoteWatchlist,
      refreshRemotePortfolio,
      clearRemoteData,
    }),
    [
      remoteWatchlist,
      remoteWatchlistUpdatedAt,
      watchlistLoaded,
      remotePortfolio,
      remotePortfolioUpdatedAt,
      portfolioLoaded,
      syncWatchlist,
      syncPortfolio,
      refreshRemoteWatchlist,
      refreshRemotePortfolio,
      clearRemoteData,
    ]
  );

  return (
    <AuthContext.Provider value={authValue}>
      <DataContext.Provider value={dataValue}>{children}</DataContext.Provider>
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

export function useData() {
  return useContext(DataContext);
}
