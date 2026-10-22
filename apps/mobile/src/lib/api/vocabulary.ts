import { endOfToday } from '../dates';
import type { SrsResult } from '../srs';
import { currentUserId, supabase, unwrap } from '../supabase';
import type { VocabularyItem } from '../types';

/**
 * Adds a looked-up word. The (user_id, lemma_id) primary key + ignoreDuplicates
 * make it a no-op if the word is already there. Returns true if it was new.
 */
export async function addToVocabulary(input: {
  lemmaId: number;
  contextSentence: string;
  storyId: string;
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
export async function fetchReviewSession(limit: number, lang: string): Promise<VocabularyItem[]> {
  const due = await fetchDueVocabulary(limit, lang);
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
