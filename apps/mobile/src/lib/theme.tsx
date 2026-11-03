import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

import { setColorScheme, type ColorScheme } from '@/theme';

const STORAGE_KEY = 'fabl.colorScheme';

type ThemeValue = {
  scheme: ColorScheme;
  /** False until the scheme saved on this device is read. */
  ready: boolean;
  toggle: () => void;
};

const ThemeContext = createContext<ThemeValue | null>(null);

/**
 * Light or dark mode, chosen on the home screen and kept on the device (light by default).
 * `colors` and `themed` styles read the active scheme: the screens are remounted (keyed
 * by `scheme`, see the root layout) when it changes, so every component picks it up.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  // undefined while reading.
  const [stored, setStored] = useState<ColorScheme | undefined>(undefined);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((value) => setStored(value === 'dark' ? 'dark' : 'light'))
      .catch(() => setStored('light'));
  }, []);

  const scheme = stored ?? 'light';
  // Before the children render: they read the colors of this scheme.
  setColorScheme(scheme);

  const toggle = useCallback(() => {
    const next = scheme === 'dark' ? 'light' : 'dark';
    setStored(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch((e) => console.warn('save scheme', e));
  }, [scheme]);

  return (
    <ThemeContext.Provider value={{ scheme, ready: stored !== undefined, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useTheme outside ThemeProvider');
  return value;
}
