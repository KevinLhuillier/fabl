import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

const STORAGE_KEY = 'fabl.intro.v1';

type IntroValue = {
  /** False until the flag saved on this device is read. */
  ready: boolean;
  /** The slides were shown on this device (finished or skipped). */
  seen: boolean;
  markSeen: () => void;
};

const IntroContext = createContext<IntroValue | null>(null);

/**
 * The demo slides (intro screen): shown once on this device, after the username and before
 * the reminders. "Revoir la démo" in the profile opens them again.
 */
export function IntroProvider({ children }: { children: ReactNode }) {
  const [seen, setSeen] = useState<boolean | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((value) => setSeen(value === '1'))
      .catch(() => setSeen(false));
  }, []);

  const markSeen = useCallback(() => {
    setSeen(true);
    AsyncStorage.setItem(STORAGE_KEY, '1').catch((e) => console.warn('save intro', e));
  }, []);

  return (
    <IntroContext.Provider value={{ ready: seen !== null, seen: !!seen, markSeen }}>
      {children}
    </IntroContext.Provider>
  );
}

export function useIntro(): IntroValue {
  const value = useContext(IntroContext);
  if (!value) throw new Error('useIntro outside IntroProvider');
  return value;
}
