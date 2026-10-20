import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import type { Messages } from '@/i18n';

import { supabase } from './supabase';

type AuthContextValue = {
  session: Session | null;
  /** False until the stored session has been restored. */
  ready: boolean;
};

const AuthContext = createContext<AuthContextValue>({ session: null, ready: false });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  return <AuthContext.Provider value={{ session, ready }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

/** Supabase auth errors, in the interface language. */
export function authErrorMessage(t: Messages, message: string): string {
  const e = t.signIn.errors;
  if (/invalid login credentials/i.test(message)) return e.invalidCredentials;
  if (/email not confirmed/i.test(message)) return e.emailNotConfirmed;
  if (/already registered/i.test(message)) return e.alreadyRegistered;
  if (/password should be at least/i.test(message)) return e.passwordTooShort;
  if (/valid email|invalid format/i.test(message)) return e.invalidEmail;
  return message;
}
