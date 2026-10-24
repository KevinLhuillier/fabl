/**
 * Admin access: sign in with a Taleway account (Supabase Auth, same accounts as
 * the mobile app) that has `app_metadata.admin = true`.
 *
 * The browser never sees Supabase: the server signs in on its behalf and keeps
 * the session tokens in HttpOnly cookies. Every API call checks them again
 * against Supabase (with a short cache), so revoking an admin takes effect
 * within seconds. Grant access with `npm run grant-admin -- <email>`.
 */
import { createClient, type Session, type User } from '@supabase/supabase-js';
import type { Context } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';

import type { AdminUser } from '../shared/api.js';
import { HttpError, requireDb } from './stories.js';

const ACCESS = 'fabl_admin_at';
const REFRESH = 'fabl_admin_rt';
const COOKIE = { httpOnly: true, sameSite: 'Strict', path: '/api' } as const;

/** Only app_metadata counts: users can edit their own user_metadata. */
export const isAdmin = (user: User) => user.app_metadata?.admin === true;

/**
 * A throwaway client per sign-in / refresh: signing in on the shared service
 * client would make its later requests run as that user instead of bypassing RLS.
 */
function authClient() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function toAdminUser(user: User): AdminUser {
  return { id: user.id, email: user.email ?? '' };
}

function saveSession(c: Context, session: Session) {
  setCookie(c, ACCESS, session.access_token, { ...COOKIE, maxAge: session.expires_in });
  // Refresh tokens are single use; Supabase keeps them valid long after the access token.
  setCookie(c, REFRESH, session.refresh_token, { ...COOKIE, maxAge: 60 * 60 * 24 * 30 });
}

function clearSession(c: Context) {
  deleteCookie(c, ACCESS, COOKIE);
  deleteCookie(c, REFRESH, COOKIE);
}

/** Checked users by access token, so a page load doesn't hit Supabase a dozen times. */
const verified = new Map<string, { user: User; until: number }>();
const CACHE_MS = 30_000;

async function userFromToken(token: string): Promise<User | null> {
  const hit = verified.get(token);
  if (hit && hit.until > Date.now()) return hit.user;
  const { data, error } = await requireDb().auth.getUser(token);
  if (error || !data.user) {
    verified.delete(token);
    return null;
  }
  if (verified.size > 100) verified.clear();
  verified.set(token, { user: data.user, until: Date.now() + CACHE_MS });
  return data.user;
}

/** The signed-in user (refreshing an expired session), or null. */
async function currentUser(c: Context): Promise<User | null> {
  const token = getCookie(c, ACCESS);
  if (token) {
    const user = await userFromToken(token);
    if (user) return user;
  }
  const refreshToken = getCookie(c, REFRESH);
  if (!refreshToken) return null;
  const { data, error } = await authClient().auth.refreshSession({ refresh_token: refreshToken });
  if (error || !data.session || !data.user) {
    clearSession(c);
    return null;
  }
  saveSession(c, data.session);
  return data.user;
}

/** Signed-in admin, or 401 (not signed in) / 403 (not an admin). */
export async function requireAdmin(c: Context): Promise<User> {
  const user = await currentUser(c);
  if (!user) throw new HttpError(401, 'Connecte-toi pour accéder à l’admin.');
  if (!isAdmin(user)) throw new HttpError(403, 'Ce compte n’a pas accès à l’admin.');
  return user;
}

export async function signIn(c: Context, email: string, password: string): Promise<AdminUser> {
  requireDb();
  const { data, error } = await authClient().auth.signInWithPassword({ email, password });
  if (error || !data.session) throw new HttpError(401, authErrorMessage(error?.message ?? ''));
  if (!isAdmin(data.user)) {
    // Don't leave an unused session behind.
    await requireDb()
      .auth.admin.signOut(data.session.access_token)
      .catch(() => {});
    throw new HttpError(403, 'Ce compte n’a pas accès à l’admin.');
  }
  saveSession(c, data.session);
  return toAdminUser(data.user);
}

export async function signOut(c: Context) {
  const token = getCookie(c, ACCESS);
  if (token) {
    verified.delete(token);
    // Revokes the refresh token too; ignore failures (already expired…).
    await requireDb()
      .auth.admin.signOut(token)
      .catch(() => {});
  }
  clearSession(c);
}

export async function me(c: Context): Promise<AdminUser> {
  return toAdminUser(await requireAdmin(c));
}

function authErrorMessage(message: string): string {
  if (/invalid login credentials/i.test(message)) return 'Email ou mot de passe incorrect.';
  if (/email not confirmed/i.test(message))
    return 'Confirme ton adresse email (lien reçu par email), puis reconnecte-toi.';
  return message || 'Connexion impossible.';
}
