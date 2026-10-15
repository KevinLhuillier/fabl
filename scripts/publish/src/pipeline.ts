/**
 * Publishing steps shared by the CLI (publish.ts) and the admin web app:
 * parse + lemmatize a story file, then write it to Supabase.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

import { lemmasWithoutTranslation, publishStory, wordCount } from './db.js';
import { lemmaKeyId, lemmatizePassages, type LemmaKey, type Token } from './lemmatize.js';
import { parseStory, type ParsedStory } from './story.js';
import { loadTranslations } from './translations.js';

export type StoryAnalysis = {
  story: ParsedStory;
  tokensByPage: Map<string, Token[]>;
  /** Distinct lemmas of the story, sorted by word. */
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

function uniqueLemmas(tokens: Token[]): LemmaKey[] {
  const map = new Map<string, LemmaKey>();
  for (const t of tokens) if (t.lemma) map.set(lemmaKeyId(t.lemma), t.lemma);
  return [...map.values()].sort((a, b) => a.word.localeCompare(b.word));
}
