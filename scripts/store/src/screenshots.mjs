/**
 * Phone screenshots of the store listing (1080x1920), per language, taken in the
 * web build of the app with a signed-in Premium account:
 *   1-translate  reader with the word sheet open
 *   2-home       home screen
 *   3-story      a story page
 *   4-words      the user's word list
 *   5-review     a review exercise (a sentence to complete)
 *
 * Needs the app served on the web: `npx expo start --web --no-dev` in apps/mobile.
 * Usage: npm run store-screenshots -- --login   (once: sign in, then close the window)
 *        npm run store-screenshots [-- <lang>...] [--final=fr]
 *
 * The interface language is switched from the profile, so it is saved on the account;
 * --final sets the one left at the end (default fr).
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import puppeteer from 'puppeteer-core';

import { OUT_DIR, appLangNames, chromePath, selectedLangs, sleep } from './common.mjs';

const APP_URL = process.env.APP_URL ?? 'http://localhost:8081';
/** In progress for the account, so it is the "continue reading" card of the home screen. */
const READ_STORY = 'Max Level';
/** Word of the reader's current page whose sheet is shown. */
const WORD = 'squashed';
/** Story whose page is shown. */
const STORY = 'Mira and the Dragon Egg';

/** 405x720 dp at 8/3 = 1080x1920 px (9:16), about a common Android phone. */
const VIEWPORT = {
  width: 405,
  height: 720,
  deviceScaleFactor: 8 / 3,
  isMobile: true,
  hasTouch: true,
};
/** No scrollbars, no focus ring, entering animations shown at their end state. */
const CSS =
  '::-webkit-scrollbar{display:none} *{scrollbar-width:none}' +
  ' *,*::before,*::after{animation-duration:0s!important;animation-delay:0s!important}' +
  ' *:focus,*:focus-visible{outline:none!important}';

const args = process.argv.slice(2);
const profileDir = join(OUT_DIR, '.chrome-profile');

try {
  await fetch(APP_URL);
} catch {
  console.error(
    `The app is not served on ${APP_URL}: run \`npx expo start --web --no-dev\` in apps/mobile.`,
  );
  process.exit(1);
}

if (args.includes('--login')) {
  const browser = await puppeteer.launch({
    executablePath: chromePath(),
    headless: false,
    userDataDir: profileDir,
    defaultViewport: null,
    args: ['--window-size=440,820', APP_URL],
  });
  console.log('Sign in with a Premium account in the Chrome window, then close it.');
  await new Promise((resolve) => browser.on('disconnected', resolve));
  process.exit(0);
}

const names = appLangNames();
const langs = selectedLangs(args);
const final = args.find((a) => a.startsWith('--final='))?.slice(8) ?? 'fr';
for (const l of [...langs, final])
  if (!names[l]) throw new Error(`The app has no "${l}" language.`);

const browser = await puppeteer.launch({
  executablePath: chromePath(),
  headless: true,
  userDataDir: profileDir,
});
const page = await browser.newPage();
await page.setViewport(VIEWPORT);
await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);

const text = () => page.evaluate(() => document.body.innerText);

/** Opens a route and waits for the app past its launch screen, then for images. */
async function go(path) {
  await page.goto(APP_URL + path, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await page.addStyleTag({ content: CSS });
  for (let i = 0; i < 60 && (await text()).trim().length < 30; i++) await sleep(1000);
  await sleep(5000);
}

/** Leaf element showing exactly this text, scrolled into view. */
async function find(label) {
  return page.evaluate((t) => {
    const el = [...document.querySelectorAll('body *')].find(
      (e) => e.childElementCount === 0 && e.textContent.trim() === t && e.offsetParent !== null,
    );
    if (!el) return null;
    el.scrollIntoView({ block: 'center' });
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }, label);
}

/** Real mouse click (buttons ignore synthetic clicks on the web). */
async function click(label, after = 4000) {
  const at = await find(label);
  if (!at) throw new Error(`"${label}" not found on ${page.url()}`);
  await page.mouse.click(at.x, at.y, { delay: 120 });
  await sleep(after);
}

async function shot(lang, name) {
  await page.addStyleTag({ content: CSS });
  await page.screenshot({ path: join(OUT_DIR, lang, `${name}.png`) });
  console.log(`out/${lang}/${name}.png`);
}

async function setLang(lang) {
  await go('/profile');
  await click(names[lang]);
}

/** Premium is read after the rest: wait for the free-plan card of the word list to go. */
async function checkPremium() {
  await go('/vocabulary');
  for (let i = 0; i < 20; i++) {
    if (!/\d+ \/ \d+/.test(await text())) return;
    await sleep(1000);
  }
  throw new Error(
    'The account is not Premium (free-plan card on the word list): premium chapters would be locked.',
  );
}

try {
  await checkPremium();
  for (const lang of langs) {
    console.log(`== ${lang}`);
    mkdirSync(join(OUT_DIR, lang), { recursive: true });
    await setLang(lang);

    await go('/');
    await shot(lang, '2-home');
    await click(STORY);
    await shot(lang, '3-story');

    // The reader opens only once premium is known, else the story page shows the offer.
    for (let i = 0; i < 3 && !page.url().includes('/read/'); i++) {
      await go('/');
      await click(READ_STORY, 7000);
    }
    if (!page.url().includes('/read/')) throw new Error(`"${READ_STORY}" did not open the reader.`);
    await click(WORD, 3000);
    await shot(lang, '1-translate');

    await go('/vocabulary');
    await shot(lang, '4-words');

    // The exercise is random: retry until one with a sentence (the dictation one is mostly empty).
    for (let i = 0; i < 8; i++) {
      await go('/review');
      if ((await text()).length > 120) break;
    }
    await shot(lang, '5-review');
  }
} finally {
  await setLang(final).catch((e) =>
    console.warn(`Could not set the language back to ${final}:`, e.message),
  );
  await browser.close();
}
