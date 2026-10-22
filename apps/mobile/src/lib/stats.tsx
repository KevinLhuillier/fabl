import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

import { haptics } from '@/theme';

import { useAuth } from './auth';
import {
  countStreakDay,
  fetchStats,
  fetchTodaySeconds,
  recordActivity,
  setDailyGoal,
  setReadAlong,
  setUserLang,
} from './gamification';
import type { UserStats } from './types';

type StatsContextValue = {
  stats: UserStats | null;
  /** False while the signed-in user's stats are loading (true once tried, even on failure). */
  ready: boolean;
  /** Seconds of practice (reading + review) today. */
  todaySeconds: number;
  /** Set when today's goal was just reached (shows the goal message), until dismissed. */
  goalReachedAt: number | null;
  dismissGoalReached: () => void;
  refresh: () => Promise<void>;
  /** Adds practice time; never throws (time tracking must not block reading). */
  addActivity: (seconds: number) => Promise<void>;
  updateDailyGoal: (minutes: number) => Promise<void>;
  updateReadAlong: (enabled: boolean) => Promise<void>;
  updateLang: (lang: string) => Promise<void>;
};

const StatsContext = createContext<StatsContextValue | null>(null);

/** Shares the user's practice time / streak / daily goal / reading settings across screens. */
export function StatsProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [todaySeconds, setTodaySeconds] = useState(0);
  const [goalReachedAt, setGoalReachedAt] = useState<number | null>(null);
  // User whose stats have been fetched (or failed to).
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const [s, t] = await Promise.all([fetchStats(), fetchTodaySeconds()]);
    setStats(s);
    setTodaySeconds(t);
  }, []);

  useEffect(() => {
    if (!session) return;
    const userId = session.user.id;
    Promise.all([fetchStats(), fetchTodaySeconds()])
      .then(([s, t]) => {
        setStats(s);
        setTodaySeconds(t);
      })
      .catch(console.warn)
      .finally(() => setLoadedFor(userId));
  }, [session]);

  const addActivity = useCallback(async (seconds: number) => {
    try {
      const result = await recordActivity(seconds);
      setStats(result.stats);
      setTodaySeconds(result.todaySeconds);
      if (result.goalJustReached) {
        haptics.success();
        setGoalReachedAt(Date.now());
      }
    } catch (e) {
      console.warn('recordActivity failed', e);
    }
  }, []);

  const updateDailyGoal = useCallback(
    async (minutes: number) => {
      // A lower goal may already be reached today: count the day right away.
      setStats(await countStreakDay(await setDailyGoal(minutes), todaySeconds));
    },
    [todaySeconds],
  );

  const dismissGoalReached = useCallback(() => setGoalReachedAt(null), []);

  const updateReadAlong = useCallback(async (enabled: boolean) => {
    setStats(await setReadAlong(enabled));
  }, []);

  const updateLang = useCallback(async (lang: string) => {
    setStats(await setUserLang(lang));
  }, []);

  return (
    // Signed out: hide the previous user's numbers.
    <StatsContext.Provider
      value={{
        stats: session ? stats : null,
        ready: !session || loadedFor === session.user.id,
        todaySeconds: session ? todaySeconds : 0,
        goalReachedAt: session ? goalReachedAt : null,
        dismissGoalReached,
        refresh,
        addActivity,
        updateDailyGoal,
        updateReadAlong,
        updateLang,
      }}>
      {children}
    </StatsContext.Provider>
  );
}

export function useStats() {
  const ctx = useContext(StatsContext);
  if (!ctx) throw new Error('useStats must be used inside StatsProvider');
  return ctx;
}
