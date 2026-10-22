/**
 * Checking a typed translation.
 *
 * Translations look like "supporter, tolérer (« can't abide » : ne pas supporter)":
 * comma-separated synonyms, with notes in brackets. Any synonym is accepted,
 * with or without its article ("le chat" / "chat", "to run" / "run").
 * - exact: same text, ignoring case, spacing and punctuation;
 * - close: right word with a missing accent or a single typo;
 * - wrong: anything else.
 */

export type AnswerResult = 'exact' | 'close' | 'wrong';

/** Articles and particles that may be typed or left out. */
const LEADING: Record<string, RegExp> = {
  en: /^(the|an?|to) /,
  fr: /^(le|la|les|un|une|des) |^l'/,
  es: /^(el|la|los|las|un|una|unos|unas) /,
  pt: /^(o|a|os|as|um|uma|uns|umas) /,
  it: /^(il|lo|la|i|gli|le|un|uno|una) |^(l|un)'/,
  de: /^(der|die|das|ein|eine|einen) /,
};

const clean = (s: string) =>
  s
    .toLowerCase()
    .replace(/[’‘`]/g, "'")
    .replace(/[.!?¡¿"«»…]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const stripAccents = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');

const stripLeading = (s: string, lang: string) => {
  const re = LEADING[lang];
  return re ? s.replace(re, '').trim() : s;
};

/** Translation without its bracketed notes. */
export const withoutNotes = (s: string) =>
  s
    .replace(/\([^)]*\)/g, '')
    .replace(/\s+/g, ' ')
    .trim();

/** The synonyms a translation accepts, cleaned and without articles. */
function alternatives(expected: string, lang: string): string[] {
  return withoutNotes(expected)
    .split(/[,;/]/)
    .map((a) => stripLeading(clean(a), lang))
    .filter(Boolean);
}

function levenshtein(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(
        prev[j]! + 1,
        row[j - 1]! + 1,
        prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = row;
  }
  return prev[b.length]!;
}

/** Compares a typed answer with the expected word or translation, written in `lang`. */
export function checkAnswer(input: string, expected: string, lang: string): AnswerResult {
  const typed = stripLeading(clean(input), lang);
  if (!typed) return 'wrong';
  const alts = alternatives(expected, lang);
  if (alts.includes(typed)) return 'exact';
  const loose = stripAccents(typed);
  for (const alt of alts.map(stripAccents)) {
    if (alt === loose) return 'close';
    // One typo is forgiven, except on short words where it changes the word.
    if (alt.length >= 4 && levenshtein(alt, loose) <= 1) return 'close';
  }
  return 'wrong';
}
