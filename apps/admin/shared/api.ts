/** Types exchanged between the admin server (server/) and the web app (src/). */

export type Level = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

/**
 * draft        file only, never published
 * published    file and app are in sync
 * modified     file edited since the last publish
 * online-only  in the app, but no file in content/stories
 */
export type StoryStatus = 'draft' | 'published' | 'modified' | 'online-only';

export type PublishedInfo = {
  title: string;
  level: Level;
  coverUrl: string | null;
  chapters: number;
  pages: number;
  words: number;
  /** Last publish (ISO date). */
  at: string;
};

export type StoryListItem = {
  slug: string;
  title: string;
  level: Level;
  summary: string;
  cover: string | null;
  status: StoryStatus;
  chapters: number;
  pages: number;
  /** Format error of the file, if any (it can't be published until fixed). */
  error: string | null;
  /** Last change of the file (ISO date), null without file. */
  fileUpdatedAt: string | null;
  published: PublishedInfo | null;
};

export type StoryDetail = {
  slug: string;
  /** Markdown source, null for an online-only story. */
  source: string | null;
  status: StoryStatus;
  fileUpdatedAt: string | null;
  published: PublishedInfo | null;
};

export type Lemma = { word: string; pos: string };

/** A lemma to translate, with the paragraph where it first appears (suggested example). */
export type MissingLemma = Lemma & { context: string };

/** Result of "Vérifier" (dry run) or "Publier". */
export type AnalysisReport = {
  published: boolean;
  words: number;
  pages: number;
  lemmas: number;
  chapters: { title: string; pages: number; words: number }[];
  warnings: string[];
  /** Lemmas without translation: in the translation file (check) or the database (publish). */
  missing: MissingLemma[];
};

export type TranslationInput = Lemma & { translation: string; example?: string };

export type ServerStatus = {
  /** Supabase keys found in the repo's .env. */
  supabase: boolean;
  lang: string;
};

/** Signed-in admin (Fabl account with app_metadata.admin = true). */
export type AdminUser = { id: string; email: string };

export type ApiError = { error: string };
