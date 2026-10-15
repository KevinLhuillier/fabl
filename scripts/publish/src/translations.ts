import { existsSync, readFileSync } from 'node:fs';
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
