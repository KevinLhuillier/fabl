/**
 * Imports content/translations/<lang>.json into Supabase (idempotent upsert).
 *
 *   npm run seed-translations [-- --lang fr]
 */
import { parseArgs } from 'node:util';

import { adminClient, upsertTranslations } from './db.js';
import { loadTranslations, translationsPath } from './translations.js';

const { values } = parseArgs({ options: { lang: { type: 'string', default: 'fr' } } });

async function main() {
  const lang = values.lang;
  const { entries } = loadTranslations(lang);
  if (!entries.length) throw new Error(`No entries in ${translationsPath(lang)}.`);
  const count = await upsertTranslations(adminClient(), lang, entries);
  console.log(`✅ ${count} "${lang}" translations upserted.`);
}

main().catch((e: unknown) => {
  console.error(`❌ ${e instanceof Error ? e.message : String(e)}`);
  process.exitCode = 1;
});
