/**
 * Called by the app right after a purchase or a restore, so premium content opens at once
 * instead of waiting for the webhook. Only syncs the signed-in caller (JWT checked by Supabase,
 * then resolved to the user here).
 */
import { admin, json, syncSubscription } from '../_shared/revenuecat.ts';

Deno.serve(async (req) => {
  const token = req.headers.get('Authorization')?.replace(/^Bearer /, '');
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return json({ error: 'unauthorized' }, 401);
  try {
    return json({ premium: (await syncSubscription(data.user.id)) ?? false });
  } catch (e) {
    console.error(e);
    return json({ error: String(e) }, 502);
  }
});
