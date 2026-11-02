/**
 * Daily allowance of free accounts (enforced by the database, see
 * 20261103000000_daily_allowance.sql): one premium chapter unlocked a day, all stories
 * together, and one review session a day. Days are the device's local days.
 */
import { localDateString } from '../dates';
import { supabase, unwrap } from '../supabase';

export type Unlocks = {
  /** Premium chapters the user can read (unlocked any day). */
  chapterIds: Set<string>;
  /** Today's unlock is used: the next premium chapter opens tomorrow. */
  usedToday: boolean;
};

export async function fetchUnlocks(): Promise<Unlocks> {
  const rows = unwrap(await supabase.from('chapter_unlocks').select('chapter_id, local_date')) as {
    chapter_id: string;
    local_date: string | null;
  }[];
  const today = localDateString();
  return {
    chapterIds: new Set(rows.map((r) => r.chapter_id)),
    usedToday: rows.some((r) => r.local_date === today),
  };
}

/** Opens a chapter with today's unlock; 'limit' when it is already used. */
export async function unlockChapter(chapterId: string): Promise<'ok' | 'limit'> {
  const { error } = await supabase.rpc('unlock_chapter', {
    p_chapter_id: chapterId,
    p_local_date: localDateString(),
  });
  if (error?.message === 'chapter_limit') return 'limit';
  if (error) throw new Error(error.message);
  return 'ok';
}

/** Today's review session is done (free accounts get one a day). */
export async function reviewedToday(): Promise<boolean> {
  const { count, error } = await supabase
    .from('review_sessions')
    .select('local_date', { count: 'exact', head: true })
    .eq('local_date', localDateString());
  if (error) throw new Error(error.message);
  return (count ?? 0) > 0;
}

/** Records today's review session; 'limit' when a free account already had one. */
export async function startReviewSession(): Promise<'ok' | 'limit'> {
  const { error } = await supabase.rpc('start_review_session', {
    p_local_date: localDateString(),
  });
  if (error?.message === 'review_limit') return 'limit';
  if (error) throw new Error(error.message);
  return 'ok';
}
