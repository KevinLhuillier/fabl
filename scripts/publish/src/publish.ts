/**
 * Publishes Markdown stories to Supabase.
 *
 *   npm run publish-story -- content/stories/a1-xxx.md [more.md] [--dry-run] [--lang fr]
 *
 * --dry-run  parse + lemmatize only, no database access; missing translations
 *            are then checked against content/translations/<lang>.json.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';

import { adminClient, lemmasWithoutTranslation, publishStory, wordCount } from './db.js';
import { resolveUserPath } from './env.js';
import { parseStory, type ParsedStory } from './story.js';
import { lemmaKeyId, lemmatizePassages, type LemmaKey, type Token } from './lemmatize.js';
import { loadTranslations } from './translations.js';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    'dry-run': { type: 'boolean', default: false },
    lang: { type: 'string', default: 'fr' },
  },
});

async function main() {
  if (!positionals.length) {
    console.error('Usage: npm run publish-story -- <file.md> [...] [--dry-run] [--lang fr]');
    process.exitCode = 1;
    return;
  }
  for (const file of positionals) await publishFile(resolveUserPath(file));
}

async function publishFile(file: string) {
  // The slug comes from the file name: renaming a file creates a new story.
  const slug = path.basename(file, path.extname(file));
  console.log(`\n📖 ${slug}`);

  const story = parseStory(readFileSync(file, 'utf8'), path.basename(file));
  const { meta, chapters } = story;
  const pages = chapters.flatMap((c) => c.pages);

  const tokenLists = await lemmatizePassages(pages.map((p) => p.lines));
  const tokensByPage = new Map<string, Token[]>(pages.map((p, i) => [p.key, tokenLists[i]!]));
  const lemmas = uniqueLemmas([...tokensByPage.values()].flat());
  const words = tokenLists.reduce((n, t) => n + wordCount(t), 0);

  console.log(
    `   "${meta.title}" — ${meta.level} — ${chapters.length} chapters, ${pages.length} pages, ${words} words`,
  );
  printChapters(story, tokensByPage);
  console.log(`   ${lemmas.length} distinct lemmas`);

  for (const w of story.warnings) console.warn(`   ⚠️  ${w}`);

  let missing: LemmaKey[];
  if (values['dry-run']) {
    const known = new Set(loadTranslations(values.lang).entries.map(lemmaKeyId));
    missing = lemmas.filter((l) => !known.has(lemmaKeyId(l)));
    console.log('   (dry run: nothing written)');
  } else {
    const db = adminClient();
    const { lemmaIds } = await publishStory(db, slug, story, tokensByPage);
    const missingIds = new Set(
      await lemmasWithoutTranslation(db, [...new Set(lemmaIds.values())], values.lang),
    );
    missing = lemmas.filter((l) => missingIds.has(lemmaIds.get(lemmaKeyId(l))!));
    console.log('   ✅ published');
  }

  if (missing.length) {
    console.log(`\n   ${missing.length} lemma(s) without "${values.lang}" translation:`);
    for (const l of missing) console.log(`     - ${l.word} (${l.pos})`);
  } else {
    console.log(`   All lemmas have a "${values.lang}" translation.`);
  }
}

function uniqueLemmas(tokens: Token[]): LemmaKey[] {
  const map = new Map<string, LemmaKey>();
  for (const t of tokens) if (t.lemma) map.set(lemmaKeyId(t.lemma), t.lemma);
  return [...map.values()].sort((a, b) => a.word.localeCompare(b.word));
}

function printChapters({ chapters }: ParsedStory, tokensByPage: Map<string, Token[]>) {
  for (const c of chapters) {
    const words = c.pages.reduce((n, p) => n + wordCount(tokensByPage.get(p.key)!), 0);
    console.log(`   ${c.position + 1}. ${c.title} — ${c.pages.length} pages, ${words} words`);
  }
}

main().catch((e: unknown) => {
  console.error(`\n❌ ${e instanceof Error ? e.message : String(e)}`);
  process.exitCode = 1;
});
