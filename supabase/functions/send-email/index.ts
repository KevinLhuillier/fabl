/**
 * Supabase Auth "Send Email" hook: Supabase hands every auth email to this function instead
 * of sending it, and the function sends it from the Taleway Gmail account (SMTP), in the
 * user's interface language (user_stats.lang). The password reset is the one the app uses
 * (a 6-digit code).
 *
 * Gmail rather than an email API: no domain is needed, Google signs the emails (they reach the
 * inbox), up to ~500 a day. Port 465: Edge Functions may not connect to ports 25 and 587.
 *
 * Secrets (`npx supabase secrets set …`):
 * - GMAIL_USER: the sending address (taleway.app@gmail.com);
 * - GMAIL_APP_PASSWORD: an app password of that account (Google Account > Security, needs
 *   2-Step Verification), not the account's password;
 * - SEND_EMAIL_HOOK_SECRET: the hook's secret (v1,whsec_…), given by the dashboard when the
 *   hook is created (Authentication > Hooks > Send Email).
 * SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
import nodemailer from 'npm:nodemailer@6.9.16';
import { Webhook } from 'npm:standardwebhooks@1.0.0';

import { LANGS, codeEmail, resetEmail, type Email, type Lang } from './email.ts';

type HookPayload = {
  user: { id: string; email: string; new_email?: string };
  email_data: {
    token: string;
    token_hash: string;
    redirect_to: string;
    email_action_type: string;
    site_url: string;
    token_new?: string;
    token_hash_new?: string;
  };
};

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false } },
);

/** Answer Supabase Auth understands: the error message reaches the app. */
const fail = (status: number, message: string) =>
  new Response(JSON.stringify({ error: { http_code: status, message } }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

/** The user's interface language; French when unknown (new account, no stats row yet). */
async function userLang(userId: string): Promise<Lang> {
  const { data, error } = await admin
    .from('user_stats')
    .select('lang')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) console.warn('user_stats', error.message);
  const lang = data?.lang as Lang | undefined;
  return lang && LANGS.includes(lang) ? lang : 'fr';
}

const GMAIL_USER = Deno.env.get('GMAIL_USER')!;

const smtp = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    user: GMAIL_USER,
    // Google shows app passwords in groups of four ("abcd efgh …"): spaces don't count.
    pass: (Deno.env.get('GMAIL_APP_PASSWORD') ?? '').replace(/\s/g, ''),
  },
});

async function send(to: string, email: Email) {
  await smtp.sendMail({
    from: { name: 'Taleway', address: GMAIL_USER },
    to,
    subject: email.subject,
    html: email.html,
    text: email.text,
  });
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return fail(405, 'method not allowed');

  let payload: HookPayload;
  try {
    const secret = (Deno.env.get('SEND_EMAIL_HOOK_SECRET') ?? '').replace('v1,whsec_', '');
    payload = new Webhook(secret).verify(
      await req.text(),
      Object.fromEntries(req.headers),
    ) as HookPayload;
  } catch (e) {
    console.error('signature', e);
    return fail(401, 'invalid signature');
  }

  const { user, email_data: data } = payload;
  try {
    const lang = await userLang(user.id);
    if (data.email_action_type === 'recovery') {
      await send(user.email, resetEmail(lang, data.token));
    } else if (data.email_action_type === 'email_change' && user.new_email && data.token_new) {
      // Double confirmation: a code to the current address and one to the new address.
      await send(user.email, codeEmail(lang, data.token));
      await send(user.new_email, codeEmail(lang, data.token_new));
    } else {
      await send(user.email, codeEmail(lang, data.token));
    }
  } catch (e) {
    console.error(data.email_action_type, e);
    return fail(500, 'email not sent');
  }
  return new Response('{}', { headers: { 'Content-Type': 'application/json' } });
});
