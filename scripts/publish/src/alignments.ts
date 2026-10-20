/**
 * Text ↔ voice-over alignments: content/alignments/<slug>.json, written by
 * `npm run align-audio`, read when publishing.
 *
 *   { "pages": { "chapter_1.page_1": { "audio": "<url>", "words": [["The", 0, 180], …] } } }
 *
 * `words` lists the page's spoken tokens (those with a letter or digit) in order,
 * with their start/end in milliseconds. An alignment only applies while the
 * page keeps the same audio URL and the same words; otherwise it is ignored
 * with a warning (re-run align-audio).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { REPO_ROOT } from './env.js';
import type { Token } from './lemmatize.js';
import type { ParsedStory } from './story.js';

export type PageAlignment = {
  audio: string;
  words: [text: string, startMs: number | null, endMs: number | null][];
};

type AlignmentFile = { pages: Record<string, PageAlignment> };

const SPOKEN = /[\p{L}\p{N}]/u;

/** Tokens that are read aloud, i.e. the ones that get a timing. */
export const spokenTokens = (tokens: Token[]) => tokens.filter((t) => SPOKEN.test(t.text));

export const alignmentsPath = (slug: string) =>
  path.join(REPO_ROOT, 'content/alignments', `${slug}.json`);

export function loadAlignments(slug: string): AlignmentFile {
  const file = alignmentsPath(slug);
  return existsSync(file)
    ? (JSON.parse(readFileSync(file, 'utf8')) as AlignmentFile)
    : { pages: {} };
}

export function savePageAlignment(slug: string, key: string, alignment: PageAlignment) {
  const data = loadAlignments(slug);
  data.pages[key] = alignment;
  // Pages sorted by key so the file diffs cleanly; one word per line.
  const pages = Object.fromEntries(
    Object.entries(data.pages).sort(([a], [b]) => a.localeCompare(b)),
  );
  const json = JSON.stringify({ pages }, null, 2).replace(
    /\[\s+("(?:[^"\\]|\\.)*"),\s+(-?\d+|null),\s+(-?\d+|null)\s+\]/g,
    '[$1, $2, $3]',
  );
  mkdirSync(path.dirname(alignmentsPath(slug)), { recursive: true });
  writeFileSync(alignmentsPath(slug), `${json}\n`, 'utf8');
}

/** Whether a stored alignment still matches the page's audio and words. */
export function isAlignmentCurrent(
  alignment: PageAlignment | undefined,
  audio: string,
  tokens: Token[],
): alignment is PageAlignment {
  const spoken = spokenTokens(tokens);
  return (
    !!alignment &&
    alignment.audio === audio &&
    alignment.words.length === spoken.length &&
    alignment.words.every(([text], i) => text === spoken[i]!.text)
  );
}

/** Copies the stored timings onto the tokens of each page with a voice-over. */
export function applyAlignments(
  slug: string,
  story: ParsedStory,
  tokensByPage: Map<string, Token[]>,
) {
  const { pages } = loadAlignments(slug);
  for (const page of story.chapters.flatMap((c) => c.pages)) {
    if (!page.audio) continue;
    const tokens = tokensByPage.get(page.key)!;
    const alignment = pages[page.key];
    if (!alignment) continue;
    if (!isAlignmentCurrent(alignment, page.audio, tokens)) {
      story.warnings.push(
        `${page.key}: text or audio changed since the alignment, run align-audio again (no highlighting meanwhile).`,
      );
      continue;
    }
    spokenTokens(tokens).forEach((t, i) => {
      const [, start, end] = alignment.words[i]!;
      if (start !== null && end !== null) {
        t.startMs = start;
        t.endMs = end;
      }
    });
  }
}
