/**
 * Shared helpers of the store scripts: paths, the listing languages and Chrome.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const STORE_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
export const REPO_DIR = join(STORE_DIR, '..', '..');
export const LISTING_DIR = join(STORE_DIR, 'listing');
export const OUT_DIR = join(STORE_DIR, 'out');
export const APP_ICON = join(REPO_DIR, 'apps', 'mobile', 'assets', 'images', 'icon.png');

/** Languages of the store listing: one folder per language in listing/. */
export function listingLangs() {
  return readdirSync(LISTING_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
}

/**
 * Each app language in its own name ("Deutsch"), as the language buttons of the
 * profile show it. Read from the app so a new language needs no change here.
 */
export function appLangNames() {
  const source = readFileSync(join(REPO_DIR, 'apps', 'mobile', 'src', 'i18n', 'index.tsx'), 'utf8');
  const block = source.match(/LANG_NAMES[^{]*\{([^}]*)\}/)?.[1] ?? '';
  return Object.fromEntries([...block.matchAll(/(\w+):\s*'([^']+)'/g)].map((m) => [m[1], m[2]]));
}

/** Installed Chrome (puppeteer-core does not download one). CHROME_PATH overrides it. */
export function chromePath() {
  const candidates = [
    process.env.CHROME_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
  ];
  const found = candidates.find((p) => p && existsSync(p));
  if (!found) throw new Error('Chrome not found: set CHROME_PATH.');
  return found;
}

/** Selected languages: the arguments (e.g. `de it`), else every listing language. */
export function selectedLangs(args) {
  const all = listingLangs();
  const wanted = args.filter((a) => !a.startsWith('--'));
  for (const l of wanted) if (!all.includes(l)) throw new Error(`No listing/${l} folder.`);
  return wanted.length ? wanted : all;
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
