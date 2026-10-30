import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase, type Profile } from '@/lib/supabase';

type AuthContextValue = {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  // Ignore stale profile responses when the account changes or signs out mid-request.
  const profileRequestId = useRef(0);

  const loadProfile = useCallback(async (userId: string, requestId: number, initialDisplayName = '') => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (requestId !== profileRequestId.current) return;
      if (error) {
        setProfile(null);
        return;
      }
      if (data) {
        setProfile(data as Profile);
        return;
      }

      // Create a basic profile only when the lookup succeeded and no row exists.
      const { data: created, error: createError } = await supabase
        .from('profiles')
        .insert({ id: userId, display_name: initialDisplayName.trim().slice(0, 40) })
        .select('*')
        .maybeSingle();

      if (requestId !== profileRequestId.current) return;
      setProfile(!createError && created ? (created as Profile) : null);
    } catch {
      if (requestId === profileRequestId.current) setProfile(null);
    }
  }, []);

  const invalidateProfileRequest = useCallback(() => {
    profileRequestId.current += 1;
  }, []);

  const refreshProfile = useCallback(async () => {
    const userId = session?.user?.id;
    if (!userId) return;
    const requestId = ++profileRequestId.current;
    await loadProfile(userId, requestId, String(session?.user?.user_metadata?.display_name ?? ''));
  }, [loadProfile, session]);

  useEffect(() => {
    let mounted = true;
    let authEventSeen = false;
    let authTimer: number | undefined;

    const applySession = (nextSession: Session | null, deferProfileLoad = false) => {
      const requestId = ++profileRequestId.current;
      setSession(nextSession);

      const userId = nextSession?.user?.id;
      if (!userId) {
        setProfile(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      const run = () => {
        if (!mounted || requestId !== profileRequestId.current) return;
        const initialDisplayName = String(nextSession?.user?.user_metadata?.display_name ?? '');
        void loadProfile(userId, requestId, initialDisplayName).finally(() => {
          if (mounted && requestId === profileRequestId.current) setLoading(false);
        });
      };

      if (deferProfileLoad) {
        if (authTimer !== undefined) window.clearTimeout(authTimer);
        // Do database work after the auth event callback has returned to avoid lock contention.
        authTimer = window.setTimeout(run, 0);
      } else {
        run();
      }
    };

    // Subscribe before reading the stored session. If an auth event arrives first,
    // its session is authoritative and a late getSession() result must not overwrite it.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      authEventSeen = true;
      applySession(nextSession, true);
    });

    supabase.auth.getSession()
      .then(({ data, error }) => {
        if (!mounted || authEventSeen) return;
        if (error) {
          ++profileRequestId.current;
          setSession(null);
          setProfile(null);
          setLoading(false);
          return;
        }
        applySession(data.session);
      })
      .catch(() => {
        if (!mounted || authEventSeen) return;
        ++profileRequestId.current;
        setSession(null);
        setProfile(null);
        setLoading(false);
      });

    return () => {
      mounted = false;
      invalidateProfileRequest();
      if (authTimer !== undefined) window.clearTimeout(authTimer);
      sub.subscription.unsubscribe();
    };
  }, [loadProfile, invalidateProfileRequest]);

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        window.alert('Gagal keluar dari akun. Periksa koneksi lalu coba lagi.');
        return;
      }
    } catch {
      window.alert('Gagal keluar dari akun. Periksa koneksi lalu coba lagi.');
      return;
    }
    ++profileRequestId.current;
    setProfile(null);
    setSession(null);
    setLoading(false);
  };

  return (
    <AuthContext.Provider value={{ session, profile, loading, refreshProfile, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
