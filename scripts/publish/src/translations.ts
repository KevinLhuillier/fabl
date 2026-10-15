import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { REPO_ROOT } from './env.js';
import { lemmaKeyId, type LemmaKey } from './lemmatize.js';

export type TranslationEntry = LemmaKey & { translation: string; example?: string };

export type TranslationFile = { lang: string; entries: TranslationEntry[] };

export const translationsPath = (lang: string) =>
  path.join(REPO_ROOT, 'content/translations', `${lang}.json`);

/** Loads and validates content/translations/<lang>.json (empty if missing). */
export function loadTranslations(lang: string): TranslationFile {
  const file = translationsPath(lang);
  if (!existsSync(file)) return { lang, entries: [] };

  const data = JSON.parse(readFileSync(file, 'utf8')) as TranslationFile;
  if (data.lang !== lang) throw new Error(`${file}: "lang" must be "${lang}".`);

  const seen = new Set<string>();
  for (const e of data.entries) {
    if (!e.word || !e.pos || !e.translation) {
      throw new Error(
        `${file}: every entry needs word, pos and translation (${JSON.stringify(e)}).`,
      );
    }
    const id = lemmaKeyId(e);
    if (seen.has(id)) throw new Error(`${file}: duplicate entry ${e.word} (${e.pos}).`);
    seen.add(id);
  }
  return data;
}

/**
 * Adds or replaces entries (by word + pos) in content/translations/<lang>.json,
 * keeping the file sorted by word.
 */
export function saveTranslations(lang: string, entries: TranslationEntry[]) {
  const file = loadTranslations(lang);
  const byKey = new Map(file.entries.map((e) => [lemmaKeyId(e), e]));
  for (const e of entries) byKey.set(lemmaKeyId(e), e);
  const sorted = [...byKey.values()].sort(
    (a, b) => a.word.localeCompare(b.word) || a.pos.localeCompare(b.pos),
  );
  mkdirSync(path.dirname(translationsPath(lang)), { recursive: true });
  writeFileSync(
    translationsPath(lang),
    `${JSON.stringify({ lang, entries: sorted }, null, 2)}\n`,
    'utf8',
  );
}
