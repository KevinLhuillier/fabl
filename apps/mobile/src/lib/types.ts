import type { CefrLevel } from '@/theme';

export type StorySummary = {
  id: string;
  slug: string;
  title: string;
  level: CefrLevel;
  summary: string;
  /** Front cover image; null → default cover drawn by the app. */
  cover_url: string | null;
  /** Total number of pages. */
  passage_count: number;
  chapter_count: number;
  word_count: number;
};

export type ChapterSummary = {
  id: string;
  storyId: string;
  position: number;
  title: string;
  pageCount: number;
  wordCount: number;
};

export type Lemma = {
  id: number;
  word: string;
  pos: string;
  translation: string | null;
  example: string | null;
};

export type Token = {
  position: number;
  text: string;
  whitespace: string;
  lemma: Lemma | null;
  /**
   * Expression the token belongs to ("up" in "pick it up"), pos PHRASE; `start` is the
   * position of its first token and tells two occurrences on a page apart.
   */
  phrase: { start: number; lemma: Lemma } | null;
  /** When the word is spoken in the page's voice-over (ms), if the page is aligned. */
  startMs: number | null;
  endMs: number | null;
};

/** A page of a chapter. */
export type Page = {
  id: string;
  index: number;
  tokens: Token[];
  /** Recorded voice-over (MP3), or null. */
  audioUrl: string | null;
};

export type ChapterProgress = {
  chapterId: string;
  /** Page the reader is on (0-based). */
  pageIndex: number;
  completed: boolean;
};

export type UserStats = {
  total_xp: number;
  current_streak: number;
  best_streak: number;
  last_active_date: string | null;
  daily_goal_xp: number;
  /** Highlight the text while the voice-over plays. */
  read_along: boolean;
  /** Interface and translation language chosen in the profile; null: device language. */
  lang: string | null;
};

export type VocabularyItem = {
  lemmaId: number;
  word: string;
  pos: string;
  translation: string | null;
  example: string | null;
  contextSentence: string | null;
  storyTitle: string | null;
  addedAt: string;
  dueAt: string;
  intervalDays: number;
  ease: number;
  repetitions: number;
};
