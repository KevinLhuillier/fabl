import { createEphemeralClient, supabase } from './supabase';

/** Emails a one-time code (the "Reset password" template must show `{{ .Token }}`). */
export async function sendResetCode(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email);
  if (error) throw error;
}

/**
 * Checks the code and saves the new password, then signs the app in with it.
 * The code opens a session: it lives on a throwaway client so the app does not
 * switch to the stories before the new password is saved.
 */
export async function resetPassword(email: string, code: string, password: string): Promise<void> {
  const client = createEphemeralClient();
  const verified = await client.auth.verifyOtp({ email, token: code, type: 'recovery' });
  if (verified.error) throw verified.error;
  const updated = await client.auth.updateUser({ password });
  if (updated.error) throw updated.error;
  // Ends the recovery session on the server too; the app gets its own just below.
  await client.auth.signOut({ scope: 'local' });
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}
