import { supabase, unwrap } from './supabase';

/** Same rule as the `user_stats.username` check constraint. */
const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,20}$/;

/** Error message thrown when the name belongs to another account (translated by `authErrorMessage`). */
export const USERNAME_TAKEN = 'Username already taken';

export const isValidUsername = (name: string) => USERNAME_PATTERN.test(name.trim());

/** Free names are compared regardless of case ("Leo" = "leo"). */
export async function isUsernameAvailable(name: string): Promise<boolean> {
  return unwrap(await supabase.rpc('username_available', { p_name: name.trim() })) as boolean;
}
