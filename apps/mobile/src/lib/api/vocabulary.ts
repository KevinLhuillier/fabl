import { endOfToday } from '../dates';
import type { SrsResult } from '../srs';
import { currentUserId, supabase, unwrap } from '../supabase';
import type { Occurrence, SentenceToken, VocabularyItem } from '../types';

/**
 * Adds a looked-up word. The (user_id, lemma_id) primary key + ignoreDuplicates
 * make it a no-op if the word is already there. Returns true if it was new.
 * The page and token position let the review find the word in its story again.
 */
export async function addToVocabulary(input: {
  lemmaId: number;
  contextSentence: string;
  storyId: string;
  passageId: string;
  /** Position of the tapped token, or of the first token of the expression. */
  tokenPosition: number;
}): Promise<boolean> {
  const userId = await currentUserId();
  const inserted = unwrap(
    await supabase
      .from('user_vocabulary')
      .upsert(
        {
          user_id: userId,
          lemma_id: input.lemmaId,
          context_sentence: input.contextSentence,
          story_id: input.storyId,
          passage_id: input.passageId,
          token_position: input.tokenPosition,
        },
        { onConflict: 'user_id,lemma_id', ignoreDuplicates: true },
      )
      .select('lemma_id'),
  ) as unknown[];
  return inserted.length > 0;
}

/** Removes a word from the user's list (its review history goes with it). */
export async function removeFromVocabulary(lemmaId: number) {
  unwrap(await supabase.from('user_vocabulary').delete().eq('lemma_id', lemmaId));
}

type RawVocab = {
  lemma_id: number;
  context_sentence: string | null;
  added_at: string;
  due_at: string;
  interval_days: number;
  ease: number;
  repetitions: number;
  stories: { title: string } | null;
  lemmas: {
    word: string;
    pos: string;
    translations: { translation: string; example: string | null }[];
  } | null;
};

const VOCAB_SELECT = `lemma_id, context_sentence, added_at, due_at, interval_days, ease, repetitions,
  stories(title), lemmas(word, pos, translations(translation, example))`;

function toItem(r: RawVocab): VocabularyItem {
  const t = r.lemmas?.translations[0];
  return {
    lemmaId: r.lemma_id,
    word: r.lemmas?.word ?? '?',
    pos: r.lemmas?.pos ?? '',
    translation: t?.translation ?? null,
    example: t?.example ?? null,
    contextSentence: r.context_sentence,
    storyTitle: r.stories?.title ?? null,
    addedAt: r.added_at,
    dueAt: r.due_at,
    intervalDays: r.interval_days,
    ease: r.ease,
    repetitions: r.repetitions,
  };
}

/** The user's words, with their `lang` translation. */
export async function fetchVocabulary(lang: string): Promise<VocabularyItem[]> {
  const rows = unwrap(
    await supabase
      .from('user_vocabulary')
      .select(VOCAB_SELECT)
      .eq('lemmas.translations.lang', lang)
      .order('added_at', { ascending: false }),
  ) as unknown as RawVocab[];
  return rows.map(toItem);
}

/** Words due today (oldest due first). */
export async function fetchDueVocabulary(limit: number, lang: string): Promise<VocabularyItem[]> {
  const rows = unwrap(
    await supabase
      .from('user_vocabulary')
      .select(VOCAB_SELECT)
      .eq('lemmas.translations.lang', lang)
      .lte('due_at', endOfToday().toISOString())
      .order('due_at')
      .limit(limit),
  ) as unknown as RawVocab[];
  return rows.map(toItem);
}

/**
 * Words for a review session: due words first, then — so the user can practise
 * whenever they want — the words whose next review is the soonest.
 */
export async function fetchReviewSession(
  max: number,
  min: number,
  lang: string,
): Promise<VocabularyItem[]> {
  const due = await fetchDueVocabulary(max, lang);
  // Up to `max` due words; fewer than `min` are topped up with upcoming ones.
  const limit = Math.max(min, due.length);
  if (due.length >= limit) return due;
  const upcoming = unwrap(
    await supabase
      .from('user_vocabulary')
      .select(VOCAB_SELECT)
      .eq('lemmas.translations.lang', lang)
      .gt('due_at', endOfToday().toISOString())
      .order('due_at')
      .limit(limit - due.length),
  ) as unknown as RawVocab[];
  return [...due, ...upcoming.map(toItem)];
}

export async function countDueVocabulary(): Promise<number> {
  const { count, error } = await supabase
    .from('user_vocabulary')
    .select('lemma_id', { count: 'exact', head: true })
    .lte('due_at', endOfToday().toISOString());
  if (error) throw new Error(error.message);
  return count ?? 0;
}

/** Among `lemmaIds`, the words in the user's list that were never reviewed yet. */
export async function countWordsToLearn(lemmaIds: number[]): Promise<number> {
  if (!lemmaIds.length) return 0;
  const { count, error } = await supabase
    .from('user_vocabulary')
    .select('lemma_id', { count: 'exact', head: true })
    .in('lemma_id', lemmaIds)
    .is('last_reviewed_at', null);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function saveReview(lemmaId: number, result: SrsResult) {
  unwrap(
    await supabase
      .from('user_vocabulary')
      .update({
        interval_days: result.intervalDays,
        ease: result.ease,
        repetitions: result.repetitions,
        due_at: result.dueAt.toISOString(),
        last_reviewed_at: new Date().toISOString(),
      })
      .eq('lemma_id', lemmaId),
  );
}

type RawOccurrence = {
  lemma_id: number;
  passage_id: string;
  audio_url: string | null;
  positions: number[];
};

type RawSentenceToken = {
  position: number;
  text: string;
  whitespace: string;
  start_ms: number | null;
  end_ms: number | null;
};

/** Tokens that end a sentence: . ! ? … or a line break (as in `sentenceAround`). */
const endsSentence = (t: RawSentenceToken) =>
  /^[.!?…]+$/.test(t.text) || t.whitespace.includes('\n');

/**
 * Where each of `lemmaIds` is used in a story (the occurrence where the user met it when
 * known): the sentence around it, its tokens in that sentence and the page's voice-over.
 * Words found nowhere (story deleted) are missing from the map.
 */
export async function fetchOccurrences(lemmaIds: number[]): Promise<Map<number, Occurrence>> {
  if (!lemmaIds.length) return new Map();
  const found = unwrap(
    await supabase.rpc('vocabulary_occurrences', { p_lemma_ids: lemmaIds }),
  ) as RawOccurrence[];
  // One request per page: a page is a few hundred tokens, under the API row limit.
  const pageIds = [...new Set(found.map((o) => o.passage_id))];
  const pages = new Map(
    await Promise.all(
      pageIds.map(async (id) => {
        const tokens = unwrap(
          await supabase
            .from('tokens')
            .select('position, text, whitespace, start_ms, end_ms')
            .eq('passage_id', id)
            .order('position'),
        ) as RawSentenceToken[];
        return [id, tokens] as const;
      }),
    ),
  );

  const occurrences = new Map<number, Occurrence>();
  for (const o of found) {
    const tokens = pages.get(o.passage_id);
    const first = o.positions[0];
    const last = o.positions[o.positions.length - 1];
    if (!tokens?.length || first === undefined || last === undefined) continue;
    let start = first;
    while (start > 0 && !endsSentence(tokens[start - 1]!)) start--;
    let end = last;
    while (end < tokens.length - 1 && !endsSentence(tokens[end]!)) end++;
    // Keep a closing quote that follows the punctuation.
    if (tokens[end + 1]?.text === '"' && !tokens[end]!.whitespace) end++;
    const sentence: SentenceToken[] = tokens.slice(start, end + 1).map((t) => ({
      text: t.text,
      // The sentence is shown on one line.
      whitespace: t.whitespace.replace('\n', ''),
      startMs: t.start_ms,
      endMs: t.end_ms,
    }));
    occurrences.set(o.lemma_id, {
      sentence,
      target: o.positions.map((p) => p - start),
      audioUrl: o.audio_url,
    });
  }
  return occurrences;
}
