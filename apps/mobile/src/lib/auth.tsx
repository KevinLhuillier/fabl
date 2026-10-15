import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

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

/** Supabase auth errors, in French for the UI. */
export function authErrorMessage(message: string): string {
  if (/invalid login credentials/i.test(message)) return 'Email ou mot de passe incorrect.';
  if (/email not confirmed/i.test(message))
    return 'Confirme ton adresse email (lien reçu par email), puis reconnecte-toi.';
  if (/already registered/i.test(message)) return 'Un compte existe déjà avec cet email.';
  if (/password should be at least/i.test(message))
    return 'Le mot de passe doit contenir au moins 6 caractères.';
  if (/valid email|invalid format/i.test(message)) return 'Adresse email invalide.';
  return message;
}
