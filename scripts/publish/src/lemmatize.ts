import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { REPO_ROOT } from './env.js';
import { markPhrases, type Dependency } from './phrases.js';
import { runPythonScript } from './python.js';

type SpacyToken = {
  text: string;
  ws: string;
  lemma: string;
  pos: string;
  dep: string;
  /** Index of the head token in the line. */
  head: number;
};

export type LemmaKey = { word: string; pos: string };

export type Token = {
  position: number;
  text: string;
  /** Whitespace after the token ('\n' between lines of a passage). */
  whitespace: string;
  lemma: LemmaKey | null;
  /** The expression the token belongs to ("up" in "pick it up"), and its first token's position. */
  phrase?: { lemma: LemmaKey; start: number };
  /** When the word is read in the page's voice-over (from content/alignments). */
  startMs?: number;
  endMs?: number;
};

export const lemmaKeyId = (l: LemmaKey) => `${l.word}|${l.pos}`;

const HAS_LETTER = /\p{L}/u;

/**
 * Tokenizes + lemmatizes every passage in a single Python call (loading the
 * spaCy model is the slow part), and marks its expressions. Returns one token
 * list per passage.
 */
export async function lemmatizePassages(passages: string[][]): Promise<Token[][]> {
  const lines = passages.flat();
  const output = await runPythonScript<SpacyToken[][]>('lemmatize.py', lines);

  let cursor = 0;
  return passages.map((passageLines) => {
    const tokens: Token[] = [];
    const deps: Dependency[] = [];
    passageLines.forEach((_, lineIndex) => {
      const lineTokens = output[cursor++] ?? [];
      const lineStart = tokens.length;
      lineTokens.forEach((t, i) => {
        deps.push({ dep: t.dep, head: lineStart + t.head });
        const isLastOfLine = i === lineTokens.length - 1;
        const isLastLine = lineIndex === passageLines.length - 1;
        tokens.push({
          position: tokens.length,
          text: t.text,
          whitespace: isLastOfLine && !isLastLine ? '\n' : t.ws,
          lemma: toLemma(t, lineTokens[i + 1]),
        });
      });
    });
    markPhrases(tokens, deps);
    return tokens;
  });
}

/**
 * Normalization rules for dictionary entries:
 * - only tokens containing a letter get a lemma (no punctuation/numbers);
 * - AUX is merged into VERB ("is" → be/VERB): learners don't need the split;
 * - lowercase, except proper nouns and the pronoun "I".
 */
function toLemma(t: SpacyToken, next?: SpacyToken): LemmaKey | null {
  if (!HAS_LETTER.test(t.text) || t.pos === 'PUNCT' || t.pos === 'SPACE') return null;
  const pos = t.pos === 'AUX' ? 'VERB' : t.pos;
  const fix =
    lemmaFixes().get(`${t.text}|${pos}|${next?.text.toLowerCase() ?? ''}`) ??
    lemmaFixes().get(`${t.text}|${pos}`);
  if (fix) return fix;
  const raw = t.lemma.trim() || t.text;
  const word = pos === 'PROPN' || raw === 'I' ? raw : raw.toLowerCase();
  return { word, pos };
}

type LemmaFix = { text: string; pos: string; next?: string; word: string; lemmaPos: string };

let fixes: Map<string, LemmaKey> | null = null;

/**
 * Corrections for spaCy's mistakes ("soles" → sol instead of sole), from
 * content/lemma-fixes.json: exact token text + spaCy POS (AUX already as VERB),
 * and optionally the text of the next token, for a fix that only holds in one
 * context ("Well, well" is not the Well of another story).
 */
function lemmaFixes(): Map<string, LemmaKey> {
  if (fixes) return fixes;
  const file = path.join(REPO_ROOT, 'content/lemma-fixes.json');
  const list = existsSync(file)
    ? (JSON.parse(readFileSync(file, 'utf8')) as { fixes: LemmaFix[] }).fixes
    : [];
  fixes = new Map(
    list.map((f) => [
      [f.text, f.pos, ...(f.next === undefined ? [] : [f.next.toLowerCase()])].join('|'),
      { word: f.word, pos: f.lemmaPos },
    ]),
  );
  return fixes;
}
