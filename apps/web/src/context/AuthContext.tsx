import type { Session, User } from "@supabase/supabase-js";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { fetchMe, type MeResponse, type PlanInfo, type ProfileInfo } from "../lib/accountApi";
import { getSupabase, isSupabaseBrowserConfigured } from "../lib/supabase";

interface AuthContextValue {
  configured: boolean;
  loading: boolean;
  session: Session | null;
  user: User | null;
  profile: ProfileInfo | null;
  plan: PlanInfo | null;
  refreshProfile: () => Promise<void>;
  setCreditsLocal: (n: number) => void;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName?: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const configured = isSupabaseBrowserConfigured();
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [me, setMe] = useState<MeResponse | null>(null);

  const loadMe = useCallback(async (s: Session | null) => {
    if (!s) {
      setMe(null);
      return;
    }
    try {
      const next = await fetchMe(s);
      setMe(next);
    } catch (err) {
      console.warn("[auth] /v1/me failed", err);
      setMe(null);
    }
  }, []);

  useEffect(() => {
    if (!configured) {
      setLoading(false);
      return;
    }
    const sb = getSupabase();
    void sb.auth.getSession().then(({ data }) => {
      setSession(data.session);
      void loadMe(data.session).finally(() => setLoading(false));
    });
    const { data: sub } = sb.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      void loadMe(next);
    });
    return () => sub.subscription.unsubscribe();
  }, [configured, loadMe]);

  const signIn = useCallback(async (email: string, password: string) => {
    const sb = getSupabase();
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }, []);

  const signUp = useCallback(
    async (email: string, password: string, displayName?: string) => {
      const sb = getSupabase();
      const { error } = await sb.auth.signUp({
        email,
        password,
        options: { data: { display_name: displayName ?? email.split("@")[0] } },
      });
      if (error) throw error;
    },
    [],
  );

  const signOut = useCallback(async () => {
    const sb = getSupabase();
    await sb.auth.signOut();
    setMe(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    await loadMe(session);
  }, [loadMe, session]);

  const setCreditsLocal = useCallback((n: number) => {
    setMe((prev) =>
      prev
        ? { ...prev, profile: { ...prev.profile, credits_balance: n } }
        : prev,
    );
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      configured,
      loading,
      session,
      user: session?.user ?? null,
      profile: me?.profile ?? null,
      plan: me?.plan ?? null,
      refreshProfile,
      setCreditsLocal,
      signIn,
      signUp,
      signOut,
    }),
    [
      configured,
      loading,
      session,
      me,
      refreshProfile,
      setCreditsLocal,
      signIn,
      signUp,
      signOut,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth outside provider");
  return ctx;
}
