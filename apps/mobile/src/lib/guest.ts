/**
 * Guest accounts: the app can be used without an email (Supabase anonymous sign-in, enabled
 * by `enable_anonymous_sign_ins`). A guest is a real user with its own id: progress, words,
 * daily allowance and subscription (RevenueCat customer = Supabase user) work the same.
 *
 * Only this phone holds a guest's session: signing out or reinstalling loses the account.
 * Adding an email and a password (saveGuestAccount) turns it into a normal account, with the
 * same id, so everything is kept, the subscription included.
 */
import type { Session } from '@supabase/supabase-js';

import { supabase } from './supabase';

export const isGuest = (session: Session | null) => !!session?.user.is_anonymous;

/** Opens the app with a new guest account; the onboarding (language, goal, username) follows. */
export async function startAsGuest(): Promise<void> {
  const { error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
}

/**
 * Gives the guest account its email. 'code' when the project confirms email changes: a code
 * was emailed (confirmGuestEmail), else 'done' (the email is already the account's).
 */
export async function addGuestEmail(email: string): Promise<'code' | 'done'> {
  const { data, error } = await supabase.auth.updateUser({ email });
  if (error) throw error;
  return data.user.email === email ? 'done' : 'code';
}

/** Checks the emailed code: the email becomes the account's. */
export async function confirmGuestEmail(email: string, code: string): Promise<void> {
  const { error } = await supabase.auth.verifyOtp({ email, token: code, type: 'email_change' });
  if (error) throw error;
}

/** Last step, once the email is the account's: the password to sign in with it. */
export async function setGuestPassword(password: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
  // The new session no longer says "anonymous".
  await supabase.auth.refreshSession();
}
