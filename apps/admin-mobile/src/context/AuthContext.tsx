import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { adminApi } from '../lib/admin';
import { supabase } from '../lib/supabase';
import { useThemeContext } from './ThemeContext';

interface AuthContextValue {
  /** False until the stored session has been read. */
  ready: boolean;
  session: Session | null;
  /** Why the person was sent back to the login screen, if they were. */
  notice: string | null;
  signIn: (email: string, password: string) => Promise<string | null>;
  /** Ends only this phone's session; the default would sign out every device, including the main app. */
  signOut: (reason?: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { applySynced } = useThemeContext();
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  // Match the colors saved in the main app. Best effort: the defaults are fine if this fails.
  const userId = session?.user.id;
  useEffect(() => {
    if (!userId) {
      applySynced(null, null);
      return;
    }
    let cancelled = false;
    adminApi
      .getTheme()
      .then((theme) => !cancelled && applySynced(theme.colors, theme.mode))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [userId, applySynced]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (!error) setNotice(null);
    return error ? error.message : null;
  }, []);

  const signOut = useCallback(async (reason?: string) => {
    setNotice(reason ?? null);
    await supabase.auth.signOut({ scope: 'local' });
  }, []);

  const value = useMemo(() => ({ ready, session, notice, signIn, signOut }), [ready, session, notice, signIn, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
