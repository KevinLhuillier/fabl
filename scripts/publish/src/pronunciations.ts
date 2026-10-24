/**
 * Word pronunciations: one short ElevenLabs clip per spelled form ("take", "took",
 * "pick up"), played by the app's translation sheet and vocabulary cards.
 *
 * content/pronunciations.json (commit it) maps each normalized text to its MP3 in the
 * public "audio" bucket; the `pronunciations` table is a copy of it, upserted on every run.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import type { SupabaseClient } from '@supabase/supabase-js';

import { REPO_ROOT } from './env.js';
import type { Token } from './lemmatize.js';

export const pronunciationsPath = path.join(REPO_ROOT, 'content/pronunciations.json');

const AUDIO_BUCKET = 'audio';
const WORKERS = 3;
/** Clips generated between two saves of the JSON file and the table. */
const SAVE_EVERY = 25;

/** Same voice as the stories' voice-overs. */
export const VOICE_SETTINGS = {
  stability: 0.5,
  similarity_boost: 0.75,
  // "Clone strength: Low".
  clone_strength: 0,
};

/** Key of a text, as the app looks it up: lowercase, straight apostrophes. */
export const pronunciationKey = (text: string) => text.trim().toLowerCase().replace(/[‘’]/g, "'");

const HAS_LETTER = /\p{L}/u;
/** Contraction pieces ("n't", "'ll", "'m"): no clip of their own, the app plays the lemma. */
const CLITIC = /^'|^n't$/;

/** Normalized, deduplicated and sorted texts that get a clip (words, not punctuation or clitics). */
export function pronunciationTexts(texts: Iterable<string>): string[] {
  const keys = new Set([...texts].map(pronunciationKey));
  return [...keys].filter((k) => HAS_LETTER.test(k) && !CLITIC.test(k)).sort();
}

/**
 * Texts to pronounce for a story: lemmas, expressions and the spelled form of each
 * word ("took" as well as "take").
 */
export const storyPronunciationTexts = (tokensByPage: Map<string, Token[]>) =>
  pronunciationTexts(
    [...tokensByPage.values()]
      .flat()
      .flatMap((t) => [
        ...(t.lemma ? [t.lemma.word, t.text] : []),
        ...(t.phrase ? [t.phrase.lemma.word] : []),
      ]),
  );

export function loadPronunciations(): Map<string, string> {
  if (!existsSync(pronunciationsPath)) return new Map();
  const data = JSON.parse(readFileSync(pronunciationsPath, 'utf8')) as {
    entries: Record<string, string>;
  };
  return new Map(Object.entries(data.entries));
}

function savePronunciations(entries: Map<string, string>) {
  const sorted = Object.fromEntries([...entries].sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(pronunciationsPath, `${JSON.stringify({ entries: sorted }, null, 2)}\n`, 'utf8');
}

async function upsertRows(db: SupabaseClient, rows: { text: string; audio_url: string }[]) {
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await db
      .from('pronunciations')
      .upsert(rows.slice(i, i + 500), { onConflict: 'text' });
    if (error) throw new Error(`Upsert pronunciations: ${error.message}`);
  }
}

/** What ElevenLabs reads: the pronoun "I" capitalized, a period for a natural falling tone. */
const spokenText = (key: string) => `${key.replace(/\bi\b/g, 'I')}.`;

/** Characters ElevenLabs bills for these texts. */
export const billedCharacters = (texts: string[]) =>
  texts.reduce((n, t) => n + spokenText(t).length, 0);

/** Texts (normalized) that have no clip in content/pronunciations.json yet. */
export function missingPronunciations(texts: string[]): string[] {
  const known = loadPronunciations();
  return texts.filter((t) => !known.has(t));
}

async function speak(text: string): Promise<ArrayBuffer> {
  const apiKey = process.env.ELEVENLABS_API_KEY!;
  const voiceId = process.env.ELEVENLABS_VOICE_ID!;
  const modelId = process.env.ELEVENLABS_MODEL || 'eleven_v4';
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_64`,
      {
        method: 'POST',
        headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: spokenText(text),
          model_id: modelId,
          voice_settings: VOICE_SETTINGS,
        }),
      },
    );
    if (res.ok) return res.arrayBuffer();
    // Too many concurrent requests or a hiccup: wait and retry.
    if ((res.status === 429 || res.status >= 500) && attempt < 5) {
      await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
      continue;
    }
    throw new Error(`ElevenLabs ("${text}"): ${res.status} ${await res.text()}`);
  }
}

const objectPath = (key: string) => {
  const safe = key.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'word';
  const hash = createHash('sha1').update(key).digest('hex').slice(0, 8);
  return `words/${safe}-${hash}-${Date.now()}.mp3`;
};

/** Runs one at a time: two publishes from the admin must not both rewrite the JSON file. */
let queue: Promise<unknown> = Promise.resolve();

/**
 * Generates the clips of `texts` (normalized) missing from content/pronunciations.json —
 * or all of them with `force` — uploads them and saves them to the file and the table.
 * Texts that already have a clip are upserted into the table too, so it catches up.
 * Returns the number of clips generated.
 */
export function generatePronunciations(
  db: SupabaseClient,
  texts: string[],
  { force = false, log = console.log }: { force?: boolean; log?: (line: string) => void } = {},
): Promise<number> {
  const run = queue.then(() => generate(db, texts, force, log));
  queue = run.catch(() => undefined);
  return run;
}

async function generate(
  db: SupabaseClient,
  texts: string[],
  force: boolean,
  log: (line: string) => void,
): Promise<number> {
  if (!process.env.ELEVENLABS_API_KEY || !process.env.ELEVENLABS_VOICE_ID) {
    throw new Error('Missing ELEVENLABS_API_KEY or ELEVENLABS_VOICE_ID in .env.');
  }
  const entries = loadPronunciations();
  const known = texts.filter((t) => entries.has(t) && !force);
  await upsertRows(
    db,
    known.map((text) => ({ text, audio_url: entries.get(text)! })),
  );

  const todo = texts.filter((t) => force || !entries.has(t));
  if (!todo.length) return 0;
  log(`   🔊 ${todo.length} pronunciation(s), ${billedCharacters(todo)} characters`);

  const storage = db.storage.from(AUDIO_BUCKET);
  let pending: { text: string; audio_url: string }[] = [];
  let done = 0;
  const flush = async () => {
    if (!pending.length) return;
    const rows = pending;
    pending = [];
    savePronunciations(entries);
    await upsertRows(db, rows);
  };

  const next = [...todo];
  async function worker() {
    for (let text = next.shift(); text !== undefined; text = next.shift()) {
      const mp3 = await speak(text);
      const file = objectPath(text);
      const { error } = await storage.upload(file, mp3, {
        contentType: 'audio/mpeg',
        upsert: false,
      });
      if (error) throw new Error(`Upload ("${text}"): ${error.message}`);
      const url = storage.getPublicUrl(file).data.publicUrl;
      entries.set(text, url);
      pending.push({ text, audio_url: url });
      done++;
      if (done % SAVE_EVERY === 0) {
        log(`      ${done}/${todo.length}`);
        await flush();
      }
    }
  }

  // allSettled: on an error, the other workers finish their clip before the final save,
  // so an interrupted run keeps every clip already uploaded.
  const results = await Promise.allSettled(
    Array.from({ length: Math.min(WORKERS, todo.length) }, worker),
  );
  await flush();
  const failure = results.find((r) => r.status === 'rejected');
  if (failure) throw failure.reason;
  return done;
}
