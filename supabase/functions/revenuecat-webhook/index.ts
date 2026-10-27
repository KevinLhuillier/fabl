/**
 * RevenueCat webhook (Integrations → Webhooks): called on every subscription event
 * (purchase, renewal, cancellation, expiration, billing issue, transfer…).
 *
 * Deployed without JWT check (`--no-verify-jwt`): RevenueCat authenticates with the
 * Authorization header set in its dashboard, compared to the REVENUECAT_WEBHOOK_AUTH secret.
 * Answers 200 once synced; any error makes RevenueCat retry (5 times over ~80 min), and
 * replaying an event is harmless (the state is read back from RevenueCat).
 */
import { isUserId, json, syncSubscription } from '../_shared/revenuecat.ts';

type WebhookEvent = {
  type: string;
  app_user_id?: string;
  original_app_user_id?: string;
  aliases?: string[];
  transferred_from?: string[];
  transferred_to?: string[];
};

Deno.serve(async (req) => {
  const expected = Deno.env.get('REVENUECAT_WEBHOOK_AUTH');
  if (!expected || req.headers.get('Authorization') !== expected) {
    return json({ error: 'unauthorized' }, 401);
  }
  const { event } = (await req.json()) as { event: WebhookEvent };

  // Every Supabase user the event is about: a transfer moves premium from one to another.
  const userIds = new Set(
    [
      event.app_user_id,
      event.original_app_user_id,
      ...(event.aliases ?? []),
      ...(event.transferred_from ?? []),
      ...(event.transferred_to ?? []),
    ].filter(isUserId),
  );
  try {
    const synced: Record<string, boolean | null> = {};
    for (const id of userIds) synced[id] = await syncSubscription(id);
    console.log(event.type, synced);
    return json({ ok: true });
  } catch (e) {
    console.error(event.type, e);
    return json({ error: String(e) }, 500);
  }
});
