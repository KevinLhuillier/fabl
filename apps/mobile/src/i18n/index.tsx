import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

import { useStats } from '@/lib/stats';

import { de } from './de';
import { es } from './es';
import { fr, type Messages } from './fr';
import { it } from './it';
import { pt } from './pt';

export type { Messages };

/** Languages of the interface, which are also the languages of the word translations. */
export const LANGS = ['fr', 'es', 'pt', 'it', 'de'] as const;
export type Lang = (typeof LANGS)[number];

/** Each language in its own name, for the language picker. */
export const LANG_NAMES: Record<Lang, string> = {
  fr: 'Français',
  es: 'Español',
  pt: 'Português',
  it: 'Italiano',
  de: 'Deutsch',
};

export const MESSAGES: Record<Lang, Messages> = { fr, es, pt, it, de };
/** When none of the device languages is supported yet. */
const DEFAULT_LANG: Lang = 'fr';
const STORAGE_KEY = 'fabl.lang';

export const isLang = (value: unknown): value is Lang => LANGS.includes(value as Lang);

/** First supported language in the device settings. */
function deviceLang(): Lang {
  return (
    getLocales()
      .map((l) => l.languageCode)
      .find(isLang) ?? DEFAULT_LANG
  );
}

type I18nValue = {
  lang: Lang;
  t: Messages;
  /** False until the language last used on this device is read. */
  ready: boolean;
  setLang: (lang: Lang) => Promise<void>;
};

const I18nContext = createContext<I18nValue | null>(null);

/**
 * Language of the interface and of the translations: the one chosen in the
 * profile (saved on the account), else the device language. The last one used
 * is kept on the device so the app opens in it before the profile is loaded
 * (and on the sign-in screen).
 */
export function I18nProvider({ children }: { children: ReactNode }) {
  const { stats, updateLang } = useStats();
  // undefined while reading, null when nothing is stored yet.
  const [stored, setStored] = useState<Lang | null | undefined>(undefined);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((value) => setStored(isLang(value) ? value : null))
      .catch(() => setStored(null));
  }, []);

  const chosen = stats && isLang(stats.lang) ? stats.lang : null;
  const lang = chosen ?? stored ?? deviceLang();

  useEffect(() => {
    if (stored === undefined) return;
    AsyncStorage.setItem(STORAGE_KEY, lang).catch((e) => console.warn('save lang', e));
  }, [stored, lang]);

  const setLang = useCallback((next: Lang) => updateLang(next), [updateLang]);

  return (
    <I18nContext.Provider value={{ lang, t: MESSAGES[lang], ready: stored !== undefined, setLang }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside I18nProvider');
  return ctx;
}
