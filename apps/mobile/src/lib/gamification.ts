/**
 * Daily goal and streak — the single place where gamification rules live.
 * Tweak the constants below to rebalance the game.
 *
 * The goal is a number of minutes of practice per day: time spent reading a
 * chapter or reviewing words (see useActivityTimer). A day counts for the
 * streak once its goal is reached.
 */
import { daysBetween, localDateString } from './dates';
import { currentUserId, supabase, unwrap } from './supabase';
import { USERNAME_TAKEN } from './username';
import type { UserStats } from './types';

export const DAILY_GOAL_OPTIONS = [10, 15, 30, 45, 60] as const;
export const DEFAULT_DAILY_GOAL = 10;

/** Practice time stops counting after this long without any interaction (left the phone). */
export const IDLE_AFTER_MS = 2 * 60 * 1000;

export const goalSeconds = (stats: Pick<UserStats, 'daily_goal_minutes'> | null) =>
  (stats?.daily_goal_minutes ?? DEFAULT_DAILY_GOAL) * 60;

/**
 * Streak rule: a day counts once its goal is reached.
 * Same day → unchanged; the day after the last counted day → +1; later → reset to 1.
 */
export function nextStreak(
  stats: Pick<UserStats, 'current_streak' | 'best_streak' | 'last_active_date'>,
  today: string,
) {
  const gap = stats.last_active_date ? daysBetween(stats.last_active_date, today) : Infinity;
  const current = gap === 0 ? stats.current_streak : gap === 1 ? stats.current_streak + 1 : 1;
  return { current, best: Math.max(stats.best_streak, current), lastActive: today };
}

/** Streak to display: it is only "alive" if the goal was reached today or yesterday. */
export function displayedStreak(stats: UserStats, today = localDateString()): number {
  if (!stats.last_active_date) return 0;
  return daysBetween(stats.last_active_date, today) <= 1 ? stats.current_streak : 0;
}

const STATS_COLUMNS =
  'total_seconds, current_streak, best_streak, last_active_date, daily_goal_minutes, read_along, lang, username';

export async function fetchStats(): Promise<UserStats> {
  const userId = await currentUserId();
  const existing = unwrap(
    await supabase.from('user_stats').select(STATS_COLUMNS).eq('user_id', userId).maybeSingle(),
  );
  if (existing) return existing as UserStats;
  // The signup trigger normally creates the row; this is a safety net.
  return unwrap(
    await supabase.from('user_stats').insert({ user_id: userId }).select(STATS_COLUMNS).single(),
  ) as UserStats;
}

/** Seconds of practice today. */
export async function fetchTodaySeconds(today = localDateString()): Promise<number> {
  const row = unwrap(
    await supabase.from('daily_activity').select('seconds').eq('local_date', today).maybeSingle(),
  ) as { seconds: number } | null;
  return row?.seconds ?? 0;
}

export type ActivityResult = {
  stats: UserStats;
  todaySeconds: number;
  /** True only on the record that crossed the daily goal. */
  goalJustReached: boolean;
};

/** Adds practice time to today (and the total), then counts the day for the streak if due. */
export async function recordActivity(seconds: number): Promise<ActivityResult> {
  const today = localDateString();
  const todaySeconds = unwrap(
    await supabase.rpc('record_activity', { p_local_date: today, p_seconds: seconds }),
  ) as number;
  const before = await fetchStats();
  const stats = await countStreakDay(before, todaySeconds, today);
  return {
    stats,
    todaySeconds,
    goalJustReached:
      todaySeconds - seconds < goalSeconds(before) && todaySeconds >= goalSeconds(before),
  };
}

/** Extends the streak when today's goal is reached and today isn't counted yet. */
export async function countStreakDay(
  stats: UserStats,
  todaySeconds: number,
  today = localDateString(),
): Promise<UserStats> {
  if (todaySeconds < goalSeconds(stats) || stats.last_active_date === today) return stats;
  const streak = nextStreak(stats, today);
  return updateStats({
    current_streak: streak.current,
    best_streak: streak.best,
    last_active_date: streak.lastActive,
  });
}

async function updateStats(values: Record<string, unknown>): Promise<UserStats> {
  const userId = await currentUserId();
  return unwrap(
    await supabase
      .from('user_stats')
      .update(values)
      .eq('user_id', userId)
      .select(STATS_COLUMNS)
      .single(),
  ) as UserStats;
}

export const setDailyGoal = (minutes: number) => updateStats({ daily_goal_minutes: minutes });

export const setUserLang = (lang: string) => updateStats({ lang });

export const setReadAlong = (enabled: boolean) => updateStats({ read_along: enabled });

/** Throws the "already taken" message when another account got the name first. */
export async function setUsername(username: string): Promise<UserStats> {
  try {
    return await updateStats({ username });
  } catch (e) {
    if (e instanceof Error && /duplicate key|user_stats_username_key/i.test(e.message)) {
      throw new Error(USERNAME_TAKEN);
    }
    throw e;
  }
}
