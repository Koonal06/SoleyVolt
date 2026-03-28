import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { hasSupabaseEnv, supabase } from "../../lib/supabase";
import { getProfileByUserId, type ProfileRow } from "../../lib/supabase-data";
import { getDefaultRouteForRole, isElevatedRole, isSuperAdminRole } from "../lib/access";

type AuthContextValue = {
  isConfigured: boolean;
  isLoading: boolean;
  isProfileLoading: boolean;
  session: Session | null;
  user: User | null;
  profile: ProfileRow | null;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  userType: ProfileRow["user_type"] | null;
  defaultRoute: string;
  patchProfile: (updates: Partial<ProfileRow>) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  const profileCacheRef = useRef<Map<string, ProfileRow | null>>(new Map());
  const currentUserIdRef = useRef<string | null>(null);
  const currentProfileRef = useRef<ProfileRow | null>(null);
  const profileRequestIdRef = useRef(0);

  const patchProfile = (updates: Partial<ProfileRow>) => {
    const currentUserId = currentUserIdRef.current;

    setProfile((current) => {
      if (!current) {
        return current;
      }

      const nextProfile = {
        ...current,
        ...updates,
      };

      currentProfileRef.current = nextProfile;

      if (currentUserId) {
        profileCacheRef.current.set(currentUserId, nextProfile);
      }

      return nextProfile;
    });
  };

  useEffect(() => {
    currentProfileRef.current = profile;
  }, [profile]);

  useEffect(() => {
    if (!supabase) {
      setIsLoading(false);
      return;
    }

    let mounted = true;

    async function syncSession(nextSession: Session | null, forceProfileRefresh = false) {
      if (!mounted) {
        return;
      }

      const nextUser = nextSession?.user ?? null;
      const nextUserId = nextUser?.id ?? null;
      const sameUser = currentUserIdRef.current === nextUserId;

      currentUserIdRef.current = nextUserId;
      setSession(nextSession);
      setUser(nextUser);
      setIsLoading(false);

      if (!nextUserId) {
        setProfile(null);
        setIsProfileLoading(false);
        return;
      }

      if (!forceProfileRefresh) {
        if (sameUser && currentProfileRef.current) {
          setIsProfileLoading(false);
          return;
        }

        if (profileCacheRef.current.has(nextUserId)) {
          setProfile(profileCacheRef.current.get(nextUserId) ?? null);
          setIsProfileLoading(false);
          return;
        }
      }

      setIsProfileLoading(true);
      const requestId = ++profileRequestIdRef.current;

      try {
        const nextProfile = await getProfileByUserId(nextUserId);

        if (!mounted || requestId !== profileRequestIdRef.current || currentUserIdRef.current !== nextUserId) {
          return;
        }

        profileCacheRef.current.set(nextUserId, nextProfile);
        setProfile(nextProfile);
      } catch {
        if (!mounted || requestId !== profileRequestIdRef.current || currentUserIdRef.current !== nextUserId) {
          return;
        }

        setProfile(null);
      } finally {
        if (mounted) {
          setIsProfileLoading(false);
        }
      }
    }

    supabase.auth.getSession().then(({ data }) => {
      void syncSession(data.session);
    }).catch(() => {
      if (mounted) {
        setSession(null);
        setUser(null);
        setProfile(null);
        setIsLoading(false);
        setIsProfileLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      void syncSession(nextSession, event === "USER_UPDATED");
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
      isProfileLoading,
      session,
      user,
      profile,
      isAdmin: isElevatedRole(profile?.role),
      isSuperAdmin: isSuperAdminRole(profile?.role),
      userType: profile?.user_type ?? null,
      defaultRoute: getDefaultRouteForRole(profile?.role),
      patchProfile,
    }),
    [isLoading, isProfileLoading, profile, session, user],
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
