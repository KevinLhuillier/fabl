/**
 * Gives (or takes back) admin access to a Fabl account.
 *
 *   npm run grant-admin -- someone@example.com
 *   npm run grant-admin -- someone@example.com --revoke
 *
 * Sets app_metadata.admin on the Supabase user (only the service key can).
 * The account must already exist: sign up in the mobile app first.
 */
import { adminClient } from '../../../scripts/publish/src/db.js';

const args = process.argv.slice(2);
const revoke = args.includes('--revoke');
const email = args
  .find((a) => !a.startsWith('--'))
  ?.trim()
  .toLowerCase();
if (!email) {
  console.error('Usage: npm run grant-admin -- <email> [--revoke]');
  process.exit(1);
}

const db = adminClient();

async function findUser(email: string) {
  for (let page = 1; ; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const user = data.users.find((u) => u.email?.toLowerCase() === email);
    if (user || data.users.length < 1000) return user;
  }
}

const user = await findUser(email);
if (!user) {
  console.error(`Aucun compte pour ${email}. Crée-le d’abord dans l’app mobile.`);
  process.exit(1);
}

const { error } = await db.auth.admin.updateUserById(user.id, {
  app_metadata: { ...user.app_metadata, admin: !revoke },
});
if (error) throw error;
console.log(revoke ? `✓ ${email} n’est plus admin.` : `✓ ${email} est admin.`);
