/**
 * Review session: one exercise per word, the types mixed in the same session.
 *
 * Typed exercises (one word each):
 * - translate: English → user's language or the reverse;
 * - cloze: the story sentence with the word blanked, type it as written there;
 * - conjugate: same, for a verb used in another form than its lemma ("leapt" ← leap);
 * - storyListen: the word's pronunciation and its story sentence read by the narrator
 *   (page voice-over), type the word as heard;
 * - dictation: the word's pronunciation clip, type it;
 * - expression: an expression with one word missing ("out of ___").
 * Games: scramble (letters in order), pairs (match 4 words with their translations)
 * and true/false (a timed round of "word = translation?").
 *
 * Each word gets the least used type it allows, so a session mixes them. Missed words come
 * back at the end as a typed translation.
 */
import { endOfToday } from './dates';
import type { Occurrence, VocabularyItem } from './types';
import { withoutNotes } from './answer';

export type TypedKind =
  'translate' | 'cloze' | 'conjugate' | 'storyListen' | 'dictation' | 'expression';

/** Grade of a word in an exercise: typed answers can be "close" (accent, one typo). */
export type WordResult = { item: VocabularyItem; result: 'exact' | 'close' | 'wrong' };

type Base = {
  key: string;
  /** Retries of missed words don't update the spaced-repetition schedule. */
  retry: boolean;
};

export type TypedExercise = Base & {
  kind: TypedKind;
  item: VocabularyItem;
  /** Expected answer (synonyms separated by commas). */
  answer: string;
  /** Language the answer is typed in. */
  answerLang: string;
  /** translate: true when the user types the English word. */
  toEnglish?: boolean;
  occurrence?: Occurrence;
  /** expression: the expression's words and the index of the missing one. */
  words?: string[];
  missing?: number;
};

export type ScrambleExercise = Base & { kind: 'scramble'; item: VocabularyItem; letters: string[] };

export type PairsExercise = Base & { kind: 'pairs'; items: VocabularyItem[] };

export type TrueFalseStatement = { item: VocabularyItem; shown: string; isTrue: boolean };
export type TrueFalseExercise = Base & { kind: 'trueFalse'; statements: TrueFalseStatement[] };

export type Exercise = TypedExercise | ScrambleExercise | PairsExercise | TrueFalseExercise;

/** Words of the session an exercise asks. */
export const exerciseItems = (ex: Exercise): VocabularyItem[] =>
  ex.kind === 'pairs'
    ? ex.items
    : ex.kind === 'trueFalse'
      ? ex.statements.map((s) => s.item)
      : [ex.item];

export function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/** Notes quoting the English ("« by accident » : par accident") would give the answer away. */
export const hideEnglishNotes = (translation: string) =>
  translation
    .replace(/\([^)]*[«„“][^)]*\)/g, '')
    .replace(/\s+/g, ' ')
    .trim();

/** Translation short enough for a game tile: its first meanings, without notes. */
export function shortTranslation(translation: string) {
  const meanings = withoutNotes(translation)
    .split(';')[0]!
    .split(',')
    .map((m) => m.trim());
  let out = meanings[0] ?? '';
  for (const m of meanings.slice(1)) {
    if (`${out}, ${m}`.length > 28) break;
    out = `${out}, ${m}`;
  }
  return out;
}

const PAIRS_SIZE = 4;
const TRUE_FALSE_SIZE = 4;
/** Word-like token: letters, inner apostrophes and hyphens. */
const WORD = /^[a-z][a-z'-]*$/i;

/** The occurrence's single target token, when the word is one token of its sentence. */
function singleTarget(occ: Occurrence | undefined) {
  if (!occ || occ.target.length !== 1) return null;
  const token = occ.sentence[occ.target[0]!];
  return token && WORD.test(token.text) ? token : null;
}

/** Sentence long enough to give a real context (at least 4 words besides the target). */
const hasContext = (occ: Occurrence) => occ.sentence.filter((t) => WORD.test(t.text)).length >= 5;

/** Typed or scramble exercises a word allows, translate first. */
function singleExercises(
  item: VocabularyItem,
  occ: Occurrence | undefined,
  hasClip: boolean,
  lang: string,
  index: number,
): (TypedExercise | ScrambleExercise)[] {
  const key = String(item.lemmaId);
  const base = { key, retry: false, item };
  const toEnglish = index % 2 === 1;
  const out: (TypedExercise | ScrambleExercise)[] = [
    {
      ...base,
      kind: 'translate',
      toEnglish,
      answer: toEnglish ? item.word : item.translation!,
      answerLang: toEnglish ? 'en' : lang,
    },
  ];
  const isPhrase = item.pos === 'PHRASE';
  const target = singleTarget(occ);

  if (target && occ && !isPhrase && hasContext(occ)) {
    const conjugated = item.pos === 'VERB' && target.text.toLowerCase() !== item.word.toLowerCase();
    out.push({
      ...base,
      kind: conjugated ? 'conjugate' : 'cloze',
      answer: target.text,
      answerLang: 'en',
      occurrence: occ,
    });
  }
  // The speaker plays the word's clip; the page must be aligned to play its sentence.
  if (target && hasClip && occ?.audioUrl && target.startMs !== null && target.endMs !== null) {
    out.push({
      ...base,
      kind: 'storyListen',
      answer: target.text,
      answerLang: 'en',
      occurrence: occ,
    });
  }
  if (hasClip) out.push({ ...base, kind: 'dictation', answer: item.word, answerLang: 'en' });

  const words = item.word.split(' ');
  if (isPhrase && words.length >= 2) {
    out.push({
      ...base,
      kind: 'expression',
      answer: words[missingWord(words)]!,
      answerLang: 'en',
      words,
      missing: missingWord(words),
    });
  }
  if (!isPhrase && /^[a-z]{3,12}$/i.test(item.word)) {
    out.push({ ...base, kind: 'scramble', letters: scramble(item.word) });
  }
  return out;
}

const SMALL_WORDS = new Set([
  'a',
  'an',
  'the',
  'to',
  'of',
  'his',
  'her',
  'its',
  'my',
  'your',
  'their',
]);

/** Word to hide in an expression: the particle of a phrasal verb, else its longest word. */
function missingWord(words: string[]) {
  if (words.length === 2) return 1;
  let best = 0;
  words.forEach((w, i) => {
    if (!SMALL_WORDS.has(w) && w.length > words[best]!.length) best = i;
  });
  return best;
}

/** Letters of a word in another order (never the word itself). */
function scramble(word: string): string[] {
  const letters = word.toLowerCase().split('');
  if (new Set(letters).size < 2) return letters;
  for (;;) {
    const mixed = shuffle(letters);
    if (mixed.join('') !== letters.join('')) return mixed;
  }
}

/** Statements for a true/false round: about half are true, the false ones borrow another word's meaning. */
function statements(items: VocabularyItem[], pool: VocabularyItem[]): TrueFalseStatement[] {
  // Alternate, randomly started, so a round is never all true or all false.
  const offset = Math.random() < 0.5 ? 0 : 1;
  return items.map((item, i) => {
    const others = pool.filter(
      (o) =>
        o.lemmaId !== item.lemmaId &&
        shortTranslation(o.translation!) !== shortTranslation(item.translation!),
    );
    const samePos = others.filter((o) => o.pos === item.pos);
    const wrong = shuffle(samePos.length ? samePos : others)[0];
    const isTrue = !wrong || (i + offset) % 2 === 0;
    return { item, isTrue, shown: shortTranslation((isTrue ? item : wrong).translation!) };
  });
}

/**
 * Builds a session from the words to review. `occurrences` tells where each word is used
 * in a story; `hasClip` whether its pronunciation clip exists.
 */
export function buildSession(
  items: VocabularyItem[],
  occurrences: Map<number, Occurrence>,
  hasClip: (item: VocabularyItem) => boolean,
  lang: string,
): Exercise[] {
  // A word without translation can't be asked.
  const askable = shuffle(items.filter((i) => i.translation));
  // Games take the words that have no story or expression exercise (those are kept for
  // them), the least practised first: matching is about recognising.
  const hasOwnExercise = (i: VocabularyItem) =>
    i.pos === 'PHRASE' || !!singleTarget(occurrences.get(i.lemmaId)) ? 1 : 0;
  const byPractice = [...askable].sort(
    (a, b) => hasOwnExercise(a) - hasOwnExercise(b) || a.repetitions - b.repetitions,
  );
  const taken = new Set<number>();
  /** The `n` least practised free words, with different translations (a game tile must match one word). */
  const take = (n: number) => {
    const picked: VocabularyItem[] = [];
    for (const item of byPractice) {
      if (picked.length === n) break;
      const label = shortTranslation(item.translation!);
      if (taken.has(item.lemmaId) || picked.some((p) => shortTranslation(p.translation!) === label))
        continue;
      picked.push(item);
    }
    picked.forEach((i) => taken.add(i.lemmaId));
    return picked;
  };

  const pairItems = askable.length >= 6 ? take(PAIRS_SIZE) : [];
  // Too few distinct translations for a game: the words get their own exercise.
  if (pairItems.length < 3) pairItems.forEach((i) => taken.delete(i.lemmaId));
  const pairs: PairsExercise | null =
    pairItems.length >= 3 ? { kind: 'pairs', key: 'pairs', retry: false, items: pairItems } : null;
  const trueFalse: TrueFalseExercise | null =
    askable.length >= 10
      ? {
          kind: 'trueFalse',
          key: 'trueFalse',
          retry: false,
          statements: statements(take(TRUE_FALSE_SIZE), askable),
        }
      : null;

  const used = new Map<string, number>();
  const singles = askable
    .filter((i) => !taken.has(i.lemmaId))
    .map((item, index) => {
      const options = singleExercises(
        item,
        occurrences.get(item.lemmaId),
        hasClip(item),
        lang,
        index,
      );
      // Least used type so far; ties broken at random.
      const fewest = Math.min(...options.map((o) => used.get(o.kind) ?? 0));
      const pick = shuffle(options.filter((o) => (used.get(o.kind) ?? 0) === fewest))[0]!;
      used.set(pick.kind, (used.get(pick.kind) ?? 0) + 1);
      return pick;
    });

  const session: Exercise[] = shuffle(singles);
  // Pairs early, as a warm-up; the timed round in the second half.
  if (pairs) session.splice(Math.min(1, session.length), 0, pairs);
  if (trueFalse) session.splice(Math.ceil((session.length * 2) / 3), 0, trueFalse);
  return session;
}

/** A missed word comes back at the end as a typed translation. */
export function retryExercise(
  item: VocabularyItem,
  lang: string,
  toEnglish: boolean,
): TypedExercise {
  return {
    kind: 'translate',
    key: `${item.lemmaId}-retry`,
    retry: true,
    item,
    toEnglish,
    answer: toEnglish ? item.word : item.translation!,
    answerLang: toEnglish ? 'en' : lang,
  };
}

/** Practising ahead of schedule: true when the word is due today. */
export const isDue = (item: VocabularyItem) =>
  new Date(item.dueAt).getTime() <= endOfToday().getTime();
