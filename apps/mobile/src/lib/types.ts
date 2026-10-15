import type { CefrLevel } from '@/theme';

export type StorySummary = {
  id: string;
  slug: string;
  title: string;
  level: CefrLevel;
  summary: string;
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
};

/** A page of a chapter. */
export type Page = {
  id: string;
  index: number;
  tokens: Token[];
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
