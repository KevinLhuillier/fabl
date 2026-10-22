import { supabase, unwrap } from '../supabase';
import type { ChapterSummary, Lemma, Page, StorySummary, Token } from '../types';

const STORY_COLUMNS =
  'id, slug, title, level, summary, cover_url, passage_count, chapter_count, word_count';
const CHAPTER_COLUMNS = 'id, story_id, position, title, page_count, word_count';

type RawChapter = {
  id: string;
  story_id: string;
  position: number;
  title: string;
  page_count: number;
  word_count: number;
};

const toChapter = (c: RawChapter): ChapterSummary => ({
  id: c.id,
  storyId: c.story_id,
  position: c.position,
  title: c.title,
  pageCount: c.page_count,
  wordCount: c.word_count,
});

export async function fetchStories(): Promise<StorySummary[]> {
  return unwrap(
    await supabase.from('stories').select(STORY_COLUMNS).order('level').order('title'),
  ) as StorySummary[];
}

/** A story and its chapters, in reading order. */
export async function fetchStoryWithChapters(
  storyId: string,
): Promise<{ story: StorySummary; chapters: ChapterSummary[] }> {
  const row = unwrap(
    await supabase
      .from('stories')
      .select(`${STORY_COLUMNS}, chapters(${CHAPTER_COLUMNS})`)
      .eq('id', storyId)
      .order('position', { referencedTable: 'chapters' })
      .single(),
  ) as StorySummary & { chapters: RawChapter[] };
  const { chapters, ...story } = row;
  return { story, chapters: chapters.map(toChapter) };
}

type RawLemma = {
  id: number;
  word: string;
  pos: string;
  translations: { translation: string; example: string | null }[];
};
type RawToken = {
  position: number;
  text: string;
  whitespace: string;
  start_ms: number | null;
  end_ms: number | null;
  phrase_start: number | null;
  word: RawLemma | null;
  phrase: RawLemma | null;
};
type RawPage = { id: string; page_index: number; audio_url: string | null; tokens: RawToken[] };

const LEMMA_COLUMNS = 'id, word, pos, translations(translation, example)';

/**
 * Loads a chapter with every page, token, lemma, expression and their `lang`
 * translation in one request (a chapter is a few hundred tokens). Tokens point
 * to lemmas twice (word and expression), hence the explicit foreign keys and
 * the distinct aliases: the `lang` filters only apply through an alias.
 */
export async function fetchChapterPages(chapterId: string, lang: string): Promise<Page[]> {
  const row = unwrap(
    await supabase
      .from('chapters')
      .select(
        `id, passages(id, page_index, audio_url,
           tokens(position, text, whitespace, start_ms, end_ms, phrase_start,
             word:lemmas!tokens_lemma_id_fkey(${LEMMA_COLUMNS}),
             phrase:lemmas!tokens_phrase_lemma_id_fkey(${LEMMA_COLUMNS})))`,
      )
      .eq('id', chapterId)
      .eq('passages.tokens.word.translations.lang', lang)
      .eq('passages.tokens.phrase.translations.lang', lang)
      .single(),
  ) as { id: string; passages: RawPage[] };

  return [...row.passages]
    .sort((a, b) => a.page_index - b.page_index)
    .map((p) => ({
      id: p.id,
      index: p.page_index,
      audioUrl: p.audio_url,
      tokens: [...p.tokens]
        .sort((a, b) => a.position - b.position)
        .map((t): Token => ({
          position: t.position,
          text: t.text,
          whitespace: t.whitespace,
          startMs: t.start_ms,
          endMs: t.end_ms,
          lemma: t.word ? toLemma(t.word) : null,
          phrase:
            t.phrase && t.phrase_start !== null
              ? { start: t.phrase_start, lemma: toLemma(t.phrase) }
              : null,
        })),
    }));
}

function toLemma(l: RawLemma): Lemma {
  const t = l.translations[0];
  return {
    id: l.id,
    word: l.word,
    pos: l.pos,
    translation: t?.translation ?? null,
    example: t?.example ?? null,
  };
}
