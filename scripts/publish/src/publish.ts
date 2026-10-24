/**
 * Publishes Markdown stories to Supabase.
 *
 *   npm run publish-story -- content/stories/a1-xxx.md [more.md] [--dry-run] [--lang fr]
 *
 * --dry-run  parse + lemmatize only, no database access; missing translations
 *            are then checked against content/translations/<lang>.json.
 *
 * After publishing, the pronunciation clips of the story's new words are generated
 * (ElevenLabs, see generateWordAudio.ts).
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';

import { adminClient } from './db.js';
import { resolveUserPath } from './env.js';
import {
  analyzeStory,
  canPronounce,
  missingInTranslationFile,
  missingStoryPronunciations,
  pronounceStory,
  publishAnalysis,
} from './pipeline.js';
import type { LemmaKey } from './lemmatize.js';

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
  console.log(`
📖 ${slug}`);

  const analysis = await analyzeStory(readFileSync(file, 'utf8'), path.basename(file));
  const { story, lemmas, words, chapterWords } = analysis;
  const { meta, chapters } = story;
  const pageCount = chapters.reduce((n, c) => n + c.pages.length, 0);

  console.log(
    `   "${meta.title}" — ${meta.level} — ${chapters.length} chapters, ${pageCount} pages, ${words} words`,
  );
  chapters.forEach((c, i) =>
    console.log(
      `   ${c.position + 1}. ${c.title} — ${c.pages.length} pages, ${chapterWords[i]} words`,
    ),
  );
  console.log(`   ${lemmas.length} distinct lemmas`);

  for (const w of story.warnings) console.warn(`   ⚠️  ${w}`);

  let missing: LemmaKey[];
  if (values['dry-run']) {
    missing = missingInTranslationFile(lemmas, values.lang);
    console.log('   (dry run: nothing written)');
    console.log(`   ${missingStoryPronunciations(analysis).length} word(s) without pronunciation`);
  } else {
    const db = adminClient();
    missing = await publishAnalysis(db, slug, analysis, values.lang);
    console.log('   ✅ published');
    if (canPronounce()) await pronounceStory(db, analysis);
    else console.warn('   ⚠️  No ElevenLabs key in .env: pronunciations not generated.');
  }

  if (missing.length) {
    console.log(`
   ${missing.length} lemma(s) without "${values.lang}" translation:`);
    for (const l of missing) console.log(`     - ${l.word} (${l.pos})`);
  } else {
    console.log(`   All lemmas have a "${values.lang}" translation.`);
  }
}

main().catch((e: unknown) => {
  console.error(`\n❌ ${e instanceof Error ? e.message : String(e)}`);
  process.exitCode = 1;
});
