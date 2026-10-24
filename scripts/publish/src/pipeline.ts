/**
 * Publishing steps shared by the CLI (publish.ts) and the admin web app:
 * parse + lemmatize a story file, then write it to Supabase.
 */
import path from 'node:path';

import type { SupabaseClient } from '@supabase/supabase-js';

import { applyAlignments } from './alignments.js';
import { lemmasWithoutTranslation, publishStory, wordCount } from './db.js';
import { lemmaKeyId, lemmatizePassages, type LemmaKey, type Token } from './lemmatize.js';
import {
  generatePronunciations,
  missingPronunciations,
  storyPronunciationTexts,
} from './pronunciations.js';
import { parseStory, type ParsedStory } from './story.js';
import { loadTranslations } from './translations.js';

export type StoryAnalysis = {
  story: ParsedStory;
  tokensByPage: Map<string, Token[]>;
  /** Distinct lemmas of the story, expressions included, sorted by word. */
  lemmas: LemmaKey[];
  words: number;
  /** Word count of each chapter, in order. */
  chapterWords: number[];
};

/** Parses and lemmatizes a story file (throws on a format error). */
export async function analyzeStory(source: string, fileName: string): Promise<StoryAnalysis> {
  const story = parseStory(source, fileName);
  const pages = story.chapters.flatMap((c) => c.pages);
  const tokenLists = await lemmatizePassages(pages.map((p) => p.lines));
  const tokensByPage = new Map<string, Token[]>(pages.map((p, i) => [p.key, tokenLists[i]!]));
  applyAlignments(path.basename(fileName, path.extname(fileName)), story, tokensByPage);
  const countPages = (keys: string[]) =>
    keys.reduce((n, k) => n + wordCount(tokensByPage.get(k)!), 0);

  return {
    story,
    tokensByPage,
    lemmas: uniqueLemmas(tokenLists.flat()),
    words: countPages(pages.map((p) => p.key)),
    chapterWords: story.chapters.map((c) => countPages(c.pages.map((p) => p.key))),
  };
}

/** Lemmas without a `lang` entry in content/translations/<lang>.json (no database access). */
export function missingInTranslationFile(lemmas: LemmaKey[], lang: string): LemmaKey[] {
  const known = new Set(loadTranslations(lang).entries.map(lemmaKeyId));
  return lemmas.filter((l) => !known.has(lemmaKeyId(l)));
}

/** Publishes an analyzed story; returns its lemmas that have no `lang` translation in the database. */
export async function publishAnalysis(
  db: SupabaseClient,
  slug: string,
  { story, tokensByPage, lemmas }: StoryAnalysis,
  lang: string,
): Promise<LemmaKey[]> {
  const { lemmaIds } = await publishStory(db, slug, story, tokensByPage);
  const missingIds = new Set(
    await lemmasWithoutTranslation(db, [...new Set(lemmaIds.values())], lang),
  );
  return lemmas.filter((l) => missingIds.has(lemmaIds.get(lemmaKeyId(l))!));
}

/** Story texts (words, spelled forms, expressions) without a pronunciation clip yet. */
export const missingStoryPronunciations = ({ tokensByPage }: StoryAnalysis) =>
  missingPronunciations(storyPronunciationTexts(tokensByPage));

/** Generates the missing pronunciation clips of a story (ElevenLabs); returns how many. */
export const pronounceStory = (
  db: SupabaseClient,
  { tokensByPage }: StoryAnalysis,
  log?: (line: string) => void,
) => generatePronunciations(db, storyPronunciationTexts(tokensByPage), { log });

/** ElevenLabs is set up in .env (otherwise publishing skips the pronunciations). */
export const canPronounce = () =>
  Boolean(process.env.ELEVENLABS_API_KEY && process.env.ELEVENLABS_VOICE_ID);

function uniqueLemmas(tokens: Token[]): LemmaKey[] {
  const map = new Map<string, LemmaKey>();
  for (const t of tokens) {
    if (t.lemma) map.set(lemmaKeyId(t.lemma), t.lemma);
    if (t.phrase) map.set(lemmaKeyId(t.phrase.lemma), t.phrase.lemma);
  }
  return [...map.values()].sort((a, b) => a.word.localeCompare(b.word));
}
