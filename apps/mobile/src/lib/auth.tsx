import { isAuthRetryableFetchError, type Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import type { Messages } from '@/i18n';

import { storedSession, supabase, unwrap } from './supabase';
import { USERNAME_TAKEN } from './username';

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
    // Sessions never expire: only signing out (or a revoked account) leaves the app.
    supabase.auth.getSession().then(async ({ data, error }) => {
      // Offline with an expired access token, supabase-js answers "no session" but keeps
      // it and refreshes it once the network is back (TOKEN_REFRESHED below): stay signed in.
      const offline = !data.session && isAuthRetryableFetchError(error);
      setSession(offline ? await storedSession() : data.session);
      setReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      // The initial session comes from getSession above, which handles the offline case.
      if (event !== 'INITIAL_SESSION') setSession(next);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  return <AuthContext.Provider value={{ session, ready }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

/** Deletes the signed-in user's account and all their data, then signs out on this device. */
export async function deleteAccount(): Promise<void> {
  unwrap(await supabase.rpc('delete_account'));
  // The user no longer exists on the server: only the local session is left to clear.
  await supabase.auth.signOut({ scope: 'local' });
}

/** Supabase auth errors, in the interface language. */
export function authErrorMessage(t: Messages, message: string): string {
  const e = t.signIn.errors;
  if (/invalid login credentials/i.test(message)) return e.invalidCredentials;
  if (/email not confirmed/i.test(message)) return e.emailNotConfirmed;
  if (/already registered/i.test(message)) return e.alreadyRegistered;
  if (/password should be at least/i.test(message)) return e.passwordTooShort;
  if (/valid email|invalid format/i.test(message)) return e.invalidEmail;
  // The sign-up trigger fails when the username was taken just before.
  if (message === USERNAME_TAKEN || /database error saving new user/i.test(message)) {
    return e.usernameTaken;
  }
  if (/expired or is invalid|invalid otp/i.test(message)) return e.invalidCode;
  if (/should be different/i.test(message)) return e.samePassword;
  if (/rate limit|for security purposes/i.test(message)) return e.tooManyRequests;
  return message;
}
