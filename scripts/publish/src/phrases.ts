/**
 * Expressions: phrasal verbs ("shut up", "pick it up") and fixed phrases
 * ("of course", "come on"). An expression is a lemma like any other, with the
 * pos PHRASE, so it gets translations and can be added to the user's words.
 *
 * Two sources:
 * - phrasal verbs, from spaCy's dependency parse: a particle (`prt`) attached
 *   to a verb, even when separated from it ("pick it up" → "pick up");
 * - content/expressions.json: fixed phrases the parser can't see, matched on
 *   consecutive words (each word by its text or its lemma: "took care of" →
 *   "take care of"). The longest match wins; `ignore` lists phrasal verbs that
 *   mean nothing more than their words.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { REPO_ROOT } from './env.js';
import type { LemmaKey, Token } from './lemmatize.js';

export const PHRASE_POS = 'PHRASE';

/** Dependency of a token: its relation and the passage position of its head. */
export type Dependency = { dep: string; head: number };

type ExpressionFile = { expressions: string[]; ignore?: string[] };

let config: { expressions: string[][]; ignore: Set<string> } | null = null;

function expressionConfig() {
  if (config) return config;
  const file = path.join(REPO_ROOT, 'content/expressions.json');
  const data: ExpressionFile = existsSync(file)
    ? (JSON.parse(readFileSync(file, 'utf8')) as ExpressionFile)
    : { expressions: [] };
  const normalize = (e: string) => e.trim().toLowerCase().split(/\s+/);
  config = {
    // Longest first, so "get rid of" wins over a shorter overlapping entry.
    expressions: data.expressions.map(normalize).sort((a, b) => b.length - a.length),
    ignore: new Set((data.ignore ?? []).map((e) => normalize(e).join(' '))),
  };
  return config;
}

const phraseLemma = (words: string[]): LemmaKey => ({ word: words.join(' '), pos: PHRASE_POS });

const matches = (token: Token, word: string) =>
  !!token.lemma && (token.text.toLowerCase() === word || token.lemma.word.toLowerCase() === word);

/**
 * Sets `phrase` on the tokens of a passage that belong to an expression.
 * `deps[i]` is the dependency of `tokens[i]`. A token belongs to one expression at most.
 */
export function markPhrases(tokens: Token[], deps: Dependency[]) {
  const { expressions, ignore } = expressionConfig();
  const mark = (positions: number[], lemma: LemmaKey) => {
    const start = Math.min(...positions);
    for (const p of positions) tokens[p]!.phrase = { lemma, start };
  };
  const free = (p: number) => !tokens[p]!.phrase;

  // Fixed phrases: consecutive words, within a paragraph.
  for (let i = 0; i < tokens.length; i++) {
    for (const words of expressions) {
      const positions = words.map((_, k) => i + k);
      const fits = positions.every(
        (p, k) =>
          p < tokens.length &&
          free(p) &&
          matches(tokens[p]!, words[k]!) &&
          (k === words.length - 1 || !tokens[p]!.whitespace.includes('\n')),
      );
      if (fits) {
        mark(positions, phraseLemma(words));
        break;
      }
    }
  }

  // Phrasal verbs: verb + particle, wherever the particle stands.
  tokens.forEach((particle, p) => {
    const { dep, head } = deps[p] ?? { dep: '', head: p };
    const verb = tokens[head];
    if (dep !== 'prt' || !verb?.lemma || verb.lemma.pos !== 'VERB' || !particle.lemma) return;
    if (!free(p) || !free(head)) return;
    const words = [verb.lemma.word.toLowerCase(), particle.text.toLowerCase()];
    if (ignore.has(words.join(' '))) return;
    mark([head, p], phraseLemma(words));
  });
}
