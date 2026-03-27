import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { hasSupabaseEnv, supabase } from "../../lib/supabase";
import { getMyProfile, type ProfileRow } from "../../lib/supabase-data";

type AuthContextValue = {
  isConfigured: boolean;
  isLoading: boolean;
  session: Session | null;
  user: User | null;
  profile: ProfileRow | null;
  isAdmin: boolean;
  userType: ProfileRow["user_type"] | null;
  defaultRoute: string;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setIsLoading(false);
      return;
    }

    let mounted = true;

    async function syncSession(nextSession: Session | null) {
      if (!mounted) {
        return;
      }

      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      if (!nextSession) {
        setProfile(null);
        setIsLoading(false);
        return;
      }

      try {
        const nextProfile = await getMyProfile();

        if (!mounted) {
          return;
        }

        setProfile(nextProfile);
      } catch {
        if (!mounted) {
          return;
        }

        setProfile(null);
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    supabase.auth.getSession().then(({ data }) => {
      void syncSession(data.session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      void syncSession(nextSession);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const value = useMemo(
    () => ({
      isConfigured: hasSupabaseEnv,
      isLoading,
      session,
      user,
      profile,
      isAdmin: profile?.role === "admin",
      userType: profile?.user_type ?? null,
      defaultRoute: profile?.role === "admin" ? "/admin/dashboard" : "/app/dashboard",
    }),
    [isLoading, profile, session, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}
