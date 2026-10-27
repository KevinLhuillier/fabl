/**
 * Subscription sync with RevenueCat, shared by `revenuecat-webhook` (every change of status)
 * and `sync-subscription` (the app, right after a purchase or a restore).
 *
 * As RevenueCat recommends, events are not interpreted one by one: the customer is read back
 * with GET /v1/subscribers/{id}, which always gives the current state (renewals, cancellations,
 * grace periods, refunds and out-of-order events need no special case).
 *
 * Secrets (`npx supabase secrets set …`): REVENUECAT_SECRET_API_KEY (sk_…),
 * REVENUECAT_ENTITLEMENT (default "premium"). SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are
 * provided by Supabase.
 */
import { createClient } from 'npm:@supabase/supabase-js@2';

const ENTITLEMENT = Deno.env.get('REVENUECAT_ENTITLEMENT') ?? 'premium';

export const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false } },
);

/** App user ids are Supabase user ids (Purchases.logIn); anonymous RevenueCat ids are not. */
export const isUserId = (id: unknown): id is string =>
  typeof id === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

type Entitlement = {
  expires_date: string | null;
  grace_period_expires_date: string | null;
  product_identifier: string;
};
type Subscription = {
  store: string;
  is_sandbox: boolean;
  unsubscribe_detected_at: string | null;
  billing_issues_detected_at: string | null;
};
type Subscriber = {
  entitlements: Record<string, Entitlement>;
  subscriptions: Record<string, Subscription>;
};

async function fetchSubscriber(userId: string): Promise<Subscriber> {
  const res = await fetch(
    `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(userId)}`,
    { headers: { Authorization: `Bearer ${Deno.env.get('REVENUECAT_SECRET_API_KEY')}` } },
  );
  if (!res.ok) throw new Error(`RevenueCat ${res.status}: ${await res.text()}`);
  return ((await res.json()) as { subscriber: Subscriber }).subscriber;
}

const later = (a: string | null, b: string | null) =>
  a && b ? (Date.parse(a) > Date.parse(b) ? a : b) : (a ?? b);

/**
 * Writes the user's current RevenueCat state to `subscriptions`. Returns whether they are
 * premium now, or null for an id that is not (or no longer) a Supabase user.
 */
export async function syncSubscription(userId: string): Promise<boolean | null> {
  const subscriber = await fetchSubscriber(userId);
  const entitlement = subscriber.entitlements?.[ENTITLEMENT];
  const subscription = entitlement
    ? subscriber.subscriptions?.[entitlement.product_identifier]
    : undefined;
  // Grace period: Google keeps trying to charge, the user keeps premium meanwhile.
  const expiresAt = entitlement
    ? later(entitlement.expires_date, entitlement.grace_period_expires_date)
    : null;

  const { error } = await admin.from('subscriptions').upsert({
    user_id: userId,
    entitlement: ENTITLEMENT,
    active: !!entitlement,
    expires_at: expiresAt,
    product_id: entitlement?.product_identifier ?? null,
    store: subscription?.store ?? null,
    will_renew: subscription ? !subscription.unsubscribe_detected_at : null,
    billing_issue: !!subscription?.billing_issues_detected_at,
    sandbox: !!subscription?.is_sandbox,
    updated_at: new Date().toISOString(),
  });
  // Foreign key: the account was deleted (or the id is not a user of this project).
  if (error?.code === '23503') return null;
  if (error) throw new Error(error.message);
  return !!entitlement && (expiresAt === null || Date.parse(expiresAt) > Date.now());
}

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
