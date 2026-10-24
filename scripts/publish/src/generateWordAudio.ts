/**
 * Generates the pronunciation clips (ElevenLabs) of the dictionary's words: every
 * lemma and expression, and the spelled forms read in the stories ("took").
 *
 *   npm run generate-word-audio                                  # the whole dictionary (database)
 *   npm run generate-word-audio -- content/stories/c1-xxx.md     # the words of a story
 *   npm run generate-word-audio -- --word took --word "pick up"  # redo these clips
 *   ... --dry-run                                                # count only, nothing generated
 *
 * Only texts without a clip in content/pronunciations.json are generated (publish-story
 * does it for the story's new words). The file is saved every few clips, so an
 * interrupted run loses nothing: run it again.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';

import type { SupabaseClient } from '@supabase/supabase-js';

import { adminClient } from './db.js';
import { resolveUserPath } from './env.js';
import { analyzeStory } from './pipeline.js';
import {
  billedCharacters,
  generatePronunciations,
  missingPronunciations,
  pronunciationKey,
  pronunciationTexts,
  storyPronunciationTexts,
} from './pronunciations.js';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    word: { type: 'string', multiple: true },
    'dry-run': { type: 'boolean', default: false },
  },
});

/** Every lemma of the database and the spelled form of every word token. */
async function dictionaryTexts(db: SupabaseClient): Promise<string[]> {
  const page = 1000;
  const lemmas: { word: string }[] = [];
  for (let from = 0; ; from += page) {
    const { data, error } = await db
      .from('lemmas')
      .select('word')
      .order('id')
      .range(from, from + page - 1);
    if (error) throw new Error(`Read lemmas: ${error.message}`);
    lemmas.push(...data);
    if (data.length < page) break;
  }
  const surfaces: { text: string }[] = [];
  for (let from = 0; ; from += page) {
    const { data, error } = await db
      .from('tokens')
      .select('text')
      .not('lemma_id', 'is', null)
      .order('passage_id')
      .order('position')
      .range(from, from + page - 1);
    if (error) throw new Error(`Read tokens: ${error.message}`);
    surfaces.push(...data);
    if (data.length < page) break;
  }
  return pronunciationTexts([...lemmas.map((l) => l.word), ...surfaces.map((s) => s.text)]);
}

async function main() {
  const db = adminClient();
  const force = Boolean(values.word?.length);
  let texts: string[];
  if (values.word?.length) {
    texts = [...new Set(values.word.map(pronunciationKey))];
  } else if (positionals.length) {
    const all = new Set<string>();
    for (const arg of positionals) {
      const file = resolveUserPath(arg);
      const analysis = await analyzeStory(readFileSync(file, 'utf8'), path.basename(file));
      storyPronunciationTexts(analysis.tokensByPage).forEach((t) => all.add(t));
    }
    texts = [...all].sort();
  } else {
    console.log('Reading the dictionary…');
    texts = await dictionaryTexts(db);
  }

  const todo = force ? texts : missingPronunciations(texts);
  console.log(
    `\n🔊 ${texts.length} text(s), ${todo.length} to generate (${billedCharacters(todo)} characters)`,
  );
  if (values['dry-run']) {
    for (const t of todo.slice(0, 50)) console.log(`   ${t}`);
    if (todo.length > 50) console.log(`   … and ${todo.length - 50} more`);
    return;
  }
  const generated = await generatePronunciations(db, texts, { force });
  console.log(`\n✅ ${generated} clip(s) generated, ${texts.length} pronunciation(s) up to date.`);
}

main().catch((e: unknown) => {
  console.error(`\n❌ ${e instanceof Error ? e.message : String(e)}`);
  process.exitCode = 1;
});
