import type { Token } from './types';

/**
 * Follows a page read aloud: the speech recognizer's transcript is aligned with the
 * words of the page, which tells the words read correctly from the ones skipped or
 * misread (recognized as another word).
 *
 * The recognizer only knows words, not sounds: a word counts as mispronounced when it
 * is not recognized. Its language model forgives a slight accent.
 */

/** A word of the page as read aloud: glued tokens ("did" + "n't", “Hello,) form one word. */
export type PageWord = {
  /** Normalized spelling compared with the recognized words. */
  key: string;
  /** Tokens of the word that hold letters or digits (colored by the feedback). */
  positions: number[];
  /** Last token of the word, punctuation included. */
  last: number;
  /** Never marked wrong: names (recognizers spell them their own way) and numbers. */
  lenient: boolean;
};

/** Reading progress, in the read-along shape plus the misread tokens. */
export type ReadAloudProgress = {
  /** Tokens up to this position are read (or skipped). */
  readUpTo: number;
  /** Tokens up to this position are judged (right or wrong); the next ones are pending. */
  settledUpTo: number;
  /** Next word to read (its first token), null once the page is read. */
  current: number | null;
  /** Tokens of the words skipped or misread. */
  wrong: ReadonlySet<number>;
  /** Every word of the page has been reached. */
  done: boolean;
  /** At least one word was heard (else only a chosen start is shown). */
  heard: boolean;
};

const ALNUM = /[\p{L}\p{N}]/u;

const NUMBERS: Record<string, string> = {
  zero: '0',
  one: '1',
  two: '2',
  three: '3',
  four: '4',
  five: '5',
  six: '6',
  seven: '7',
  eight: '8',
  nine: '9',
  ten: '10',
  eleven: '11',
  twelve: '12',
  thirteen: '13',
  fourteen: '14',
  fifteen: '15',
  sixteen: '16',
  seventeen: '17',
  eighteen: '18',
  nineteen: '19',
  twenty: '20',
  thirty: '30',
  forty: '40',
  fifty: '50',
  sixty: '60',
  seventy: '70',
  eighty: '80',
  ninety: '90',
  hundred: '100',
};

/** Spellings a recognizer writes differently from the book. */
const ALIASES: Record<string, string> = {
  okay: 'ok',
  cannot: 'cant',
  mister: 'mr',
  missus: 'mrs',
  grey: 'gray',
  ...NUMBERS,
};

/**
 * Lowercase letters and digits only, with British and American spellings brought
 * together (the recognizer writes "color" for "colour"). Applied to both texts, so a
 * rule never needs to produce a real word.
 */
export function normalize(text: string): string {
  let w = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\p{N}]/gu, '');
  w = ALIASES[w] ?? w;
  if (w.length > 4) {
    w = w
      .replace(/our(s|ed|ing|ful|ite|ites)?$/, 'or$1')
      .replace(/([^aeiou])is(e|ed|es|ing|ation|ations)$/, '$1iz$2')
      .replace(/ys(e|ed|es|ing)$/, 'yz$1')
      .replace(/([^aeiou])tre(s)?$/, '$1ter$2')
      .replace(/([aeiou])ll(ed|ing|er|ers)$/, '$1l$2');
  }
  return w;
}

/** The words of a page, in reading order (punctuation alone is not a word). */
export function pageWords(tokens: Token[]): PageWord[] {
  const words: PageWord[] = [];
  let group: Token[] = [];
  // Sentence start: a capital letter there is not a name.
  let sentenceStart = true;
  const flush = () => {
    const key = normalize(group.map((t) => t.text).join(''));
    if (key) {
      const spoken = group.filter((t) => ALNUM.test(t.text));
      const first = spoken[0]!;
      const name =
        first.lemma?.pos === 'PROPN' ||
        (!sentenceStart && /^\p{Lu}/u.test(first.text) && first.text !== 'I');
      words.push({
        key,
        positions: spoken.map((t) => t.position),
        last: group[group.length - 1]!.position,
        lenient: name || /\d/.test(key),
      });
      sentenceStart = false;
    }
    if (group.some((t) => /[.!?…]/.test(t.text) || t.whitespace.includes('\n'))) {
      sentenceStart = true;
    }
    group = [];
  };
  for (const t of tokens) {
    group.push(t);
    if (t.whitespace) flush();
  }
  if (group.length) flush();
  return words;
}

/** Recognized words, normalized like the page's. */
export function transcriptWords(transcript: string): string[] {
  return transcript.split(/\s+/).map(normalize).filter(Boolean);
}

// Costs of the alignment. A misread word (substitution) costs less than an extra
// word plus a skipped one, so "sheep" read for "ship" is one misread word.
const SKIP = 1;
const SUBSTITUTE = 1;
/** Fillers, repetitions, a word read twice: cheaper than a skipped word. */
export const INSERT = 0.6;
/**
 * Extra words at the end of a settled segment (the recognizer has finished it): they can
 * no longer be words read ahead, so they cost more than misread ones. The reading then
 * moves on over the words the recognizer got wrong (marked wrong) instead of staying
 * stuck before them until the reader says the sentence again.
 */
export const SETTLED_TRAIL = 1.05;
/** A name recognized as another word: kept in place, without marking it wrong. */
const LENIENT_SUBSTITUTE = 0.2;

const Op = {
  Match: 1,
  Substitute: 2,
  Skip: 3,
  Insert: 4,
  /** One page word read as two recognized words ("every day" for "everyday"). */
  Split: 5,
  /** Two page words recognized as one ("everyday" for "every day"). */
  Join: 6,
} as const;
type OpCode = (typeof Op)[keyof typeof Op];

/** Where an alignment got to. */
export type Alignment = {
  /** Number of page words reached (read, misread or skipped), from the page's start. */
  reached: number;
  /** Page words (indexes) skipped or misread. */
  wrong: number[];
  /** Page words (indexes) recognized as written. */
  matched: number[];
};

/**
 * Aligns recognized words with the page from the word `from` (edit distance). The page
 * words after the last one reached are free: the reader has not got there yet. Words
 * before it that were skipped or misread are wrong.
 * `trail`: cost of each extra recognized word after the last word reached (see
 * SETTLED_TRAIL); inside the reading, an extra word costs INSERT.
 */
export function alignReading(
  allWords: PageWord[],
  heard: string[],
  { from = 0, trail = INSERT }: { from?: number; trail?: number } = {},
): Alignment {
  const words = allWords.slice(from);
  const R = heard.length;
  const E = words.length;
  const cols = E + 1;
  const size = (R + 1) * cols;
  // `ended`: best path to (i, j) whose last step is not an extra word; `any`: best path.
  // Kept apart so that extra words at the very end can cost `trail` instead of INSERT.
  const ended = new Float64Array(size).fill(Infinity);
  const any = new Float64Array(size).fill(Infinity);
  const op = new Uint8Array(size);
  const viaInsert = new Uint8Array(size);
  const at = (i: number, j: number) => i * cols + j;
  ended[0] = 0;
  any[0] = 0;

  for (let i = 0; i <= R; i++) {
    for (let j = 0; j <= E; j++) {
      if (i === 0 && j === 0) continue;
      let best = Infinity;
      let bestOp: OpCode = Op.Match;
      const consider = (c: number, o: OpCode) => {
        if (c < best) {
          best = c;
          bestOp = o;
        }
      };
      const word = words[j - 1];
      if (i > 0 && j > 0) {
        const same = heard[i - 1] === word!.key;
        const substitute = word!.lenient ? LENIENT_SUBSTITUTE : SUBSTITUTE;
        consider(any[at(i - 1, j - 1)]! + (same ? 0 : substitute), same ? Op.Match : Op.Substitute);
      }
      if (j > 0) consider(any[at(i, j - 1)]! + (word!.lenient ? 0 : SKIP), Op.Skip);
      if (i > 1 && j > 0 && heard[i - 2]! + heard[i - 1]! === word!.key) {
        consider(any[at(i - 2, j - 1)]!, Op.Split);
      }
      if (i > 0 && j > 1 && words[j - 2]!.key + word!.key === heard[i - 1]) {
        consider(any[at(i - 1, j - 2)]!, Op.Join);
      }
      const k = at(i, j);
      ended[k] = best;
      op[k] = bestOp;
      const inserted = i > 0 ? any[at(i - 1, j)]! + INSERT : Infinity;
      if (inserted < best) {
        any[k] = inserted;
        viaInsert[k] = 1;
      } else {
        any[k] = best;
      }
    }
  }

  // Furthest page word reached at the lowest cost, the extra words at the end costing
  // `trail` each.
  let reached = 0;
  let reachedRow = 0;
  let reachedCost = Infinity;
  for (let j = 0; j <= E; j++) {
    for (let i = 0; i <= R; i++) {
      const c = ended[at(i, j)]! + (R - i) * trail;
      if (c < reachedCost || (c === reachedCost && j > reached)) {
        reachedCost = c;
        reached = j;
        reachedRow = i;
      }
    }
  }

  const wrong: number[] = [];
  const matched: number[] = [];
  let i = reachedRow;
  let j = reached;
  // Walking back along `ended` cells; an `any` cell reached through an extra word steps up.
  let inEnded = true;
  while (i > 0 || j > 0) {
    const k = at(i, j);
    if (!inEnded && viaInsert[k]) {
      i--;
      continue;
    }
    switch (op[k]) {
      case Op.Match:
        matched.push(from + j - 1);
        i--;
        j--;
        break;
      case Op.Substitute:
      case Op.Skip: {
        const word = words[j - 1]!;
        if (!word.lenient) wrong.push(from + j - 1);
        if (op[k] === Op.Substitute) i--;
        j--;
        break;
      }
      case Op.Split:
        matched.push(from + j - 1);
        i -= 2;
        j--;
        break;
      case Op.Join:
        matched.push(from + j - 1, from + j - 2);
        i--;
        j -= 2;
        break;
      default:
        throw new Error('alignReading: no path');
    }
    inEnded = false;
  }

  return { reached: from + reached, wrong, matched };
}

const lastToken = (words: PageWord[], count: number) => (count > 0 ? words[count - 1]!.last : -1);

/**
 * The progress shown once `reached` page words are read, the first `settled` of them
 * judged, `wrong` among those.
 */
export function progressAt(
  words: PageWord[],
  reached: number,
  settled: number,
  wrong: ReadonlySet<number>,
  heard: boolean,
): ReadAloudProgress {
  const next = words[reached];
  return {
    readUpTo: lastToken(words, reached),
    settledUpTo: lastToken(words, settled),
    current: next ? next.positions[0]! : null,
    wrong,
    done: reached >= words.length,
    heard,
  };
}
