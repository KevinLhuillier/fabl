import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

import { useAuth } from './auth';
import {
  awardXp,
  fetchStats,
  fetchTodayXp,
  setDailyGoal,
  setReadAlong,
  type AwardResult,
  type XpSource,
} from './gamification';
import type { UserStats } from './types';

type StatsContextValue = {
  stats: UserStats | null;
  todayXp: number;
  refresh: () => Promise<void>;
  award: (source: XpSource, amount: number) => Promise<AwardResult | null>;
  updateDailyGoal: (goal: number) => Promise<void>;
  updateReadAlong: (enabled: boolean) => Promise<void>;
};

const StatsContext = createContext<StatsContextValue | null>(null);

/** Shares the user's XP / streak / daily goal / reading settings across screens. */
export function StatsProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [todayXp, setTodayXp] = useState(0);

  const refresh = useCallback(async () => {
    const [s, t] = await Promise.all([fetchStats(), fetchTodayXp()]);
    setStats(s);
    setTodayXp(t);
  }, []);

  useEffect(() => {
    if (!session) return;
    Promise.all([fetchStats(), fetchTodayXp()])
      .then(([s, t]) => {
        setStats(s);
        setTodayXp(t);
      })
      .catch(console.warn);
  }, [session]);

  const award = useCallback(async (source: XpSource, amount: number) => {
    try {
      const result = await awardXp(source, amount);
      setStats(result.stats);
      setTodayXp(result.todayXp);
      return result;
    } catch (e) {
      // XP must never block reading or reviewing.
      console.warn('awardXp failed', e);
      return null;
    }
  }, []);

  const updateDailyGoal = useCallback(async (goal: number) => {
    setStats(await setDailyGoal(goal));
  }, []);

  const updateReadAlong = useCallback(async (enabled: boolean) => {
    setStats(await setReadAlong(enabled));
  }, []);

  return (
    // Signed out: hide the previous user's numbers.
    <StatsContext.Provider
      value={{
        stats: session ? stats : null,
        todayXp: session ? todayXp : 0,
        refresh,
        award,
        updateDailyGoal,
        updateReadAlong,
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
