import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

import { useAuth } from './auth';

/** Per account: a new account (e.g. a guest after deleting the previous one) sees the demo. */
const storageKey = (userId: string) => `fabl.intro.v1.${userId}`;

type IntroValue = {
  /** False until the flag of the signed-in account is read. */
  ready: boolean;
  /** This account was shown the slides on this device (finished or skipped). */
  seen: boolean;
  markSeen: () => void;
};

const IntroContext = createContext<IntroValue | null>(null);

/**
 * The demo slides (intro screen): shown once per account, after the username and before
 * the reminders. "Revoir la démo" in the profile opens them again.
 */
export function IntroProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  // Read for `userId`: a flag read for another account counts as not loaded yet.
  const [stored, setStored] = useState<{ userId: string; seen: boolean } | null>(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    AsyncStorage.getItem(storageKey(userId))
      .then((value) => !cancelled && setStored({ userId, seen: value === '1' }))
      .catch(() => !cancelled && setStored({ userId, seen: false }));
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const markSeen = useCallback(() => {
    if (!userId) return;
    setStored({ userId, seen: true });
    AsyncStorage.setItem(storageKey(userId), '1').catch((e) => console.warn('save intro', e));
  }, [userId]);

  const current = userId && stored?.userId === userId ? stored : null;
  return (
    <IntroContext.Provider
      value={{ ready: !userId || current !== null, seen: !!current?.seen, markSeen }}>
      {children}
    </IntroContext.Provider>
  );
}

export function useIntro(): IntroValue {
  const value = useContext(IntroContext);
  if (!value) throw new Error('useIntro outside IntroProvider');
  return value;
}
