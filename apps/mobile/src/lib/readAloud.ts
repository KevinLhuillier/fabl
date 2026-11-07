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
const INSERT = 0.6;
/**
 * Once the reader has stopped, an extra word at the end can no longer be a word read
 * ahead: it costs more than a misread one, so the last word misread is marked wrong.
 */
const FINAL_INSERT = 1.1;
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

/**
 * Aligns the recognized words with the page from its first word (edit distance).
 * The page words after the last one reached are free: the reader has not got there
 * yet. Words before it that were skipped or misread are wrong.
 * `final`: the reader has stopped (see FINAL_INSERT).
 * `from`: index of the word the reading starts at (a word double-tapped); the words
 * before it count as read, like the voice-over played from a word.
 */
export function alignReading(
  allWords: PageWord[],
  heard: string[],
  final = false,
  from = 0,
): ReadAloudProgress {
  const words = allWords.slice(from);
  const before = from > 0 ? allWords[from - 1]!.last : -1;
  const insert = final ? FINAL_INSERT : INSERT;
  const R = heard.length;
  const E = words.length;
  const cols = E + 1;
  const cost = new Float64Array((R + 1) * cols);
  const op = new Uint8Array((R + 1) * cols);
  const at = (i: number, j: number) => i * cols + j;

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
        consider(
          cost[at(i - 1, j - 1)]! + (same ? 0 : substitute),
          same ? Op.Match : Op.Substitute,
        );
      }
      if (j > 0) consider(cost[at(i, j - 1)]! + (word!.lenient ? 0 : SKIP), Op.Skip);
      if (i > 0) consider(cost[at(i - 1, j)]! + insert, Op.Insert);
      if (i > 1 && j > 0 && heard[i - 2]! + heard[i - 1]! === word!.key) {
        consider(cost[at(i - 2, j - 1)]!, Op.Split);
      }
      if (i > 0 && j > 1 && words[j - 2]!.key + word!.key === heard[i - 1]) {
        consider(cost[at(i - 1, j - 2)]!, Op.Join);
      }
      cost[at(i, j)] = best;
      op[at(i, j)] = bestOp;
    }
  }

  // Furthest page word reached at the lowest cost.
  let reached = 0;
  for (let j = 1; j <= E; j++) if (cost[at(R, j)]! <= cost[at(R, reached)]!) reached = j;

  const wrong = new Set<number>();
  let i = R;
  let j = reached;
  while (i > 0 || j > 0) {
    switch (op[at(i, j)]) {
      case Op.Match:
        i--;
        j--;
        break;
      case Op.Substitute:
      case Op.Skip: {
        const word = words[j - 1]!;
        if (!word.lenient) word.positions.forEach((p) => wrong.add(p));
        if (op[at(i, j)] === Op.Substitute) i--;
        j--;
        break;
      }
      case Op.Insert:
        i--;
        break;
      case Op.Split:
        i -= 2;
        j--;
        break;
      case Op.Join:
        i--;
        j -= 2;
        break;
      default:
        throw new Error('alignReading: no path');
    }
  }

  const next = words[reached];
  return {
    readUpTo: reached > 0 ? words[reached - 1]!.last : before,
    current: next ? next.positions[0]! : null,
    wrong,
    done: reached === E,
    heard: R > 0,
  };
}
