/**
 * XP, streak and daily goal — the single place where gamification rules live.
 * Tweak the constants below to rebalance the game.
 */
import { daysBetween, localDateString } from './dates';
import { currentUserId, supabase, unwrap } from './supabase';
import type { UserStats } from './types';

export type XpSource = 'chapter' | 'story' | 'review';

/** XP amounts. */
export const XP_RULES = {
  /** Finishing a chapter for the first time. */
  chapterFirstCompletion: 10,
  /** Finishing a chapter already completed before (replay). */
  chapterReplay: 3,
  /** Bonus when the last unfinished chapter of a story is completed. */
  storyCompletionBonus: 20,
  /** Each correct answer in a review session (first attempt only). */
  reviewCorrectAnswer: 2,
  /** Bonus for completing a review session. */
  reviewSessionBonus: 5,
} as const;

export const DAILY_GOAL_OPTIONS = [10, 20, 30, 50] as const;
export const DEFAULT_DAILY_GOAL = 30;

/**
 * Streak rule: a day counts as soon as the user earns any XP.
 * Same day → unchanged; the day after the last active day → +1; later → reset to 1.
 */
export function nextStreak(
  stats: Pick<UserStats, 'current_streak' | 'best_streak' | 'last_active_date'>,
  today: string,
) {
  const gap = stats.last_active_date ? daysBetween(stats.last_active_date, today) : Infinity;
  const current = gap === 0 ? stats.current_streak : gap === 1 ? stats.current_streak + 1 : 1;
  return { current, best: Math.max(stats.best_streak, current), lastActive: today };
}

/** Streak to display: it is only "alive" if the user was active today or yesterday. */
export function displayedStreak(stats: UserStats, today = localDateString()): number {
  if (!stats.last_active_date) return 0;
  return daysBetween(stats.last_active_date, today) <= 1 ? stats.current_streak : 0;
}

export type AwardResult = {
  stats: UserStats;
  todayXp: number;
  gained: number;
  /** True only on the award that crossed the daily goal. */
  goalJustReached: boolean;
  /** True when this award extended the streak (first XP of the day). */
  streakExtended: boolean;
};

const STATS_COLUMNS =
  'total_xp, current_streak, best_streak, last_active_date, daily_goal_xp, read_along, lang';

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

export async function fetchTodayXp(today = localDateString()): Promise<number> {
  const rows = unwrap(
    await supabase.from('xp_events').select('amount').eq('local_date', today),
  ) as { amount: number }[];
  return rows.reduce((sum, r) => sum + r.amount, 0);
}

/**
 * Records an XP event and updates totals + streak.
 * Two writes (event, then stats): not atomic, but a failure in between only
 * leaves an extra history row — acceptable for a single-player game.
 */
export async function awardXp(source: XpSource, amount: number): Promise<AwardResult> {
  const userId = await currentUserId();
  const today = localDateString();
  const [before, todayBefore] = await Promise.all([fetchStats(), fetchTodayXp(today)]);

  unwrap(
    await supabase.from('xp_events').insert({ user_id: userId, source, amount, local_date: today }),
  );

  const streak = nextStreak(before, today);
  const stats = unwrap(
    await supabase
      .from('user_stats')
      .update({
        total_xp: before.total_xp + amount,
        current_streak: streak.current,
        best_streak: streak.best,
        last_active_date: streak.lastActive,
      })
      .eq('user_id', userId)
      .select(STATS_COLUMNS)
      .single(),
  ) as UserStats;

  const todayXp = todayBefore + amount;
  return {
    stats,
    todayXp,
    gained: amount,
    goalJustReached: todayBefore < before.daily_goal_xp && todayXp >= before.daily_goal_xp,
    streakExtended: before.last_active_date !== today,
  };
}

export async function setDailyGoal(goal: number): Promise<UserStats> {
  const userId = await currentUserId();
  return unwrap(
    await supabase
      .from('user_stats')
      .update({ daily_goal_xp: goal })
      .eq('user_id', userId)
      .select(STATS_COLUMNS)
      .single(),
  ) as UserStats;
}

export async function setUserLang(lang: string): Promise<UserStats> {
  const userId = await currentUserId();
  return unwrap(
    await supabase
      .from('user_stats')
      .update({ lang })
      .eq('user_id', userId)
      .select(STATS_COLUMNS)
      .single(),
  ) as UserStats;
}

export async function setReadAlong(enabled: boolean): Promise<UserStats> {
  const userId = await currentUserId();
  return unwrap(
    await supabase
      .from('user_stats')
      .update({ read_along: enabled })
      .eq('user_id', userId)
      .select(STATS_COLUMNS)
      .single(),
  ) as UserStats;
}
