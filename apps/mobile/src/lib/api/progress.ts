import { currentUserId, supabase, unwrap } from '../supabase';
import { fetchStoryWithChapters } from './content';
import type { ChapterProgress, ChapterSummary, StorySummary } from '../types';

type RawChapterProgress = {
  chapter_id: string;
  page_index: number;
  completed: boolean;
  updated_at: string;
  chapters: { story_id: string; page_count: number } | null;
};

const toProgress = (r: RawChapterProgress): ChapterProgress => ({
  chapterId: r.chapter_id,
  pageIndex: r.page_index,
  completed: r.completed,
});

/** Pages read in a chapter: all of them once completed, else the current page. */
const pagesRead = (r: RawChapterProgress) =>
  r.completed ? (r.chapters?.page_count ?? 0) : r.page_index;

export type StoryProgressSummary = {
  /** 0 → 1, share of the story's pages read. */
  fraction: number;
  started: boolean;
  /** Last time a chapter of the story was read (ISO), null if never. */
  lastReadAt: string | null;
};

/** Reading progress of every story, for the home tiles. */
export async function fetchProgressByStory(
  stories: StorySummary[],
): Promise<Map<string, StoryProgressSummary>> {
  const rows = unwrap(
    await supabase
      .from('user_chapter_progress')
      .select('chapter_id, page_index, completed, updated_at, chapters(story_id, page_count)'),
  ) as unknown as RawChapterProgress[];

  const read = new Map<string, number>();
  const lastRead = new Map<string, string>();
  for (const r of rows) {
    const storyId = r.chapters?.story_id;
    if (!storyId) continue;
    read.set(storyId, (read.get(storyId) ?? 0) + pagesRead(r));
    if (r.updated_at > (lastRead.get(storyId) ?? '')) lastRead.set(storyId, r.updated_at);
  }
  return new Map(
    stories.map((s) => {
      const pages = read.get(s.id) ?? 0;
      return [
        s.id,
        {
          fraction: s.passage_count ? Math.min(1, pages / s.passage_count) : 0,
          started: read.has(s.id),
          lastReadAt: lastRead.get(s.id) ?? null,
        },
      ];
    }),
  );
}

/** Progress of each chapter of a story, keyed by chapter id. */
export async function fetchChapterProgress(storyId: string): Promise<Map<string, ChapterProgress>> {
  const rows = unwrap(
    await supabase
      .from('user_chapter_progress')
      .select('chapter_id, page_index, completed, chapters!inner(story_id, page_count)')
      .eq('chapters.story_id', storyId),
  ) as unknown as RawChapterProgress[];
  return new Map(rows.map((r) => [r.chapter_id, toProgress(r)]));
}

export type ResumePoint = {
  story: StorySummary;
  chapter: ChapterSummary;
  /** Page the reader is on in that chapter (0-based). */
  pageIndex: number;
};

/**
 * Where to pick up the story read last: the first unfinished chapter of the most recently
 * read story that isn't finished. Null when no story is in progress.
 */
export async function fetchResumePoint(
  stories: StorySummary[],
  progress: Map<string, StoryProgressSummary>,
): Promise<ResumePoint | null> {
  const inProgress = stories
    .filter((s) => {
      const p = progress.get(s.id);
      return p?.lastReadAt && p.fraction < 1;
    })
    .sort((a, b) => progress.get(b.id)!.lastReadAt!.localeCompare(progress.get(a.id)!.lastReadAt!));
  const story = inProgress[0];
  if (!story) return null;
  const [{ chapters }, chapterProgress] = await Promise.all([
    fetchStoryWithChapters(story.id),
    fetchChapterProgress(story.id),
  ]);
  const chapter = chapters.find((c) => !chapterProgress.get(c.id)?.completed);
  if (!chapter) return null;
  return { story, chapter, pageIndex: chapterProgress.get(chapter.id)?.pageIndex ?? 0 };
}

/** Remembers the page the reader is on (keeps `completed` as is). */
export async function saveChapterPage(chapterId: string, pageIndex: number) {
  const userId = await currentUserId();
  unwrap(
    await supabase
      .from('user_chapter_progress')
      .upsert(
        { user_id: userId, chapter_id: chapterId, page_index: pageIndex },
        { onConflict: 'user_id,chapter_id' },
      ),
  );
}

/** Marks a chapter finished; the page resets so a replay starts at the top. */
export async function completeChapter(chapterId: string) {
  const userId = await currentUserId();
  unwrap(
    await supabase.from('user_chapter_progress').upsert(
      {
        user_id: userId,
        chapter_id: chapterId,
        page_index: 0,
        completed: true,
        completed_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,chapter_id' },
    ),
  );
}

/** True if the story-completion bonus was already given. */
export async function isStoryCompleted(storyId: string): Promise<boolean> {
  const row = unwrap(
    await supabase.from('user_progress').select('completed').eq('story_id', storyId).maybeSingle(),
  ) as { completed: boolean } | null;
  return !!row?.completed;
}

export async function completeStory(storyId: string) {
  const userId = await currentUserId();
  unwrap(
    await supabase.from('user_progress').upsert(
      {
        user_id: userId,
        story_id: storyId,
        completed: true,
        completed_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,story_id' },
    ),
  );
}
