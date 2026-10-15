import { spawn } from 'node:child_process';
import path from 'node:path';

import { pythonBin, REPO_ROOT } from './env.js';

type SpacyToken = { text: string; ws: string; lemma: string; pos: string };

export type LemmaKey = { word: string; pos: string };

export type Token = {
  position: number;
  text: string;
  /** Whitespace after the token ('\n' between lines of a passage). */
  whitespace: string;
  lemma: LemmaKey | null;
};

export const lemmaKeyId = (l: LemmaKey) => `${l.word}|${l.pos}`;

const HAS_LETTER = /\p{L}/u;

/**
 * Tokenizes + lemmatizes every passage in a single Python call (loading the
 * spaCy model is the slow part). Returns one token list per passage.
 */
export async function lemmatizePassages(passages: string[][]): Promise<Token[][]> {
  const lines = passages.flat();
  const output = await runPython(lines);

  let cursor = 0;
  return passages.map((passageLines) => {
    const tokens: Token[] = [];
    passageLines.forEach((_, lineIndex) => {
      const lineTokens = output[cursor++] ?? [];
      lineTokens.forEach((t, i) => {
        const isLastOfLine = i === lineTokens.length - 1;
        const isLastLine = lineIndex === passageLines.length - 1;
        tokens.push({
          position: tokens.length,
          text: t.text,
          whitespace: isLastOfLine && !isLastLine ? '\n' : t.ws,
          lemma: toLemma(t),
        });
      });
    });
    return tokens;
  });
}

/**
 * Normalization rules for dictionary entries:
 * - only tokens containing a letter get a lemma (no punctuation/numbers);
 * - AUX is merged into VERB ("is" → be/VERB): learners don't need the split;
 * - lowercase, except proper nouns and the pronoun "I".
 */
function toLemma(t: SpacyToken): LemmaKey | null {
  if (!HAS_LETTER.test(t.text) || t.pos === 'PUNCT' || t.pos === 'SPACE') return null;
  const pos = t.pos === 'AUX' ? 'VERB' : t.pos;
  const raw = t.lemma.trim() || t.text;
  const word = pos === 'PROPN' || raw === 'I' ? raw : raw.toLowerCase();
  return { word, pos };
}

function runPython(lines: string[]): Promise<SpacyToken[][]> {
  const script = path.join(REPO_ROOT, 'scripts/publish/lemmatize.py');
  return new Promise((resolve, reject) => {
    const child = spawn(pythonBin(), [script], {
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
    });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8').on('data', (d: string) => (stdout += d));
    child.stderr.setEncoding('utf8').on('data', (d: string) => (stderr += d));
    child.on('error', (e) =>
      reject(new Error(`Cannot start Python (${pythonBin()}): ${e.message}. Check PYTHON_BIN.`)),
    );
    child.on('close', (code) => {
      if (code !== 0) return reject(new Error(`lemmatize.py failed (exit ${code}):\n${stderr}`));
      try {
        resolve(JSON.parse(stdout) as SpacyToken[][]);
      } catch {
        reject(new Error(`lemmatize.py returned invalid JSON:\n${stdout.slice(0, 500)}`));
      }
    });
    child.stdin.end(JSON.stringify(lines), 'utf8');
  });
}
