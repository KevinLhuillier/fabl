// Étape 1 : parcourt l'appli web (mode --no-dev, port 8082) et prend des captures des écrans à filmer.
import { chromium } from 'playwright';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const APP = process.env.APP_URL ?? 'http://localhost:8082';
const DIR = fileURLToPath(new URL('.', import.meta.url));
const OUT = DIR + 'explore/';
const STATE = DIR + 'auth-state.json';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  locale: 'fr-FR',
  ...(existsSync(STATE) ? { storageState: STATE } : {}),
});
const page = await ctx.newPage();
const log = [];
const sleep = (ms) => page.waitForTimeout(ms);

async function snap(name) {
  await sleep(1200);
  await page.screenshot({ path: OUT + name + '.png' });
  const txt = (await page.evaluate(() => document.body.innerText)).slice(0, 1200);
  log.push(`### ${name}  (${page.url()})\n${txt}\n`);
  console.log('ok', name);
}

/** Centre de l'élément visible dont le texte (ou l'aria-label) vaut exactement `label`. */
async function locate(label) {
  return page.evaluate((t) => {
    const els = [...document.querySelectorAll('body *')].filter((e) => e.offsetParent !== null);
    const el =
      els.find((e) => e.childElementCount === 0 && e.textContent.trim() === t) ??
      els.find((e) => e.childElementCount === 0 && e.textContent.trim().replace(/[.,;:!?]+$/, '') === t) ??
      els.find((e) => e.getAttribute('aria-label') === t);
    if (!el) return null;
    el.scrollIntoView({ block: 'center' });
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }, label);
}

/** Clic souris réel (les boutons ignorent les clics synthétiques sur le web). */
async function tap(label, after = 2500) {
  const at = await locate(label);
  if (!at) throw new Error(`"${label}" introuvable sur ${page.url()}`);
  await page.mouse.click(at.x, at.y, { delay: 100 });
  await sleep(after);
  if (label !== 'Passer') await skipTour();
}

async function skipTour() {
  for (let i = 0; i < 4 && (await locate('Passer')); i++) await tap('Passer', 1000);
}

async function go(path) {
  await page.goto(APP + path, { waitUntil: 'domcontentloaded', timeout: 120000 });
  for (let i = 0; i < 60; i++) {
    if ((await page.evaluate(() => document.body.innerText.trim().length)) > 30) break;
    await sleep(1000);
  }
  await sleep(3000);
  await skipTour();
}

try {
  await go('/');
  if (page.url().includes('sign-in') || (await locate('Mot de passe'))) {
    await page.locator('input[type="email"], input[placeholder*="mail" i]').first().fill('kevin.lhuillier@outlook.fr');
    await page.locator('input[type="password"]').first().fill('12345678');
    await page.keyboard.press('Enter');
    await sleep(6000);
    await ctx.storageState({ path: STATE });
    await go('/');
  }
  await snap('10-library-top');
  // Liste défilante : la molette doit viser le contenu, pas l'en-tête.
  await page.mouse.move(195, 600);
  for (let i = 1; i <= 3; i++) {
    await page.mouse.wheel(0, 600);
    await snap(`11-library-scroll-${i}`);
  }
  // Inventaire des badges de niveau visibles dans la bibliothèque.
  const levels = await page.evaluate(() =>
    [...document.querySelectorAll('body *')]
      .filter((e) => e.childElementCount === 0 && /^(A1|A2|B1|B2|C1|C2)$/.test(e.textContent.trim()))
      .map((e) => e.textContent.trim()),
  );
  log.push(`### niveaux trouvés : ${levels.join(' ')}\n`);

  await go('/');
  await tap('The Quiet Signal', 4000);
  await snap('20-story-page');
  await tap('A Normal Morning', 6000);
  await snap('21-reader');
  writeFileSync(OUT + 'reader.html', await page.content());

  // Mot cliquable : "lie" est sur la page 2 du chapitre 1 (« when someone told a lie »).
  await tap('lie', 3000);
  await snap('22-word-sheet');
  await page.keyboard.press('Escape');
  await sleep(1000);
  await snap('23-after-escape');

  const u = new URL(page.url());
  await go(u.pathname + u.search);
  await tap('Écouter la page', 4000);
  await snap('24-listening-a');
  await sleep(3000);
  await snap('25-listening-b');

  await go('/vocabulary');
  await snap('30-vocabulary');
  await page.mouse.move(195, 600);
  await page.mouse.wheel(0, 600);
  await snap('31-vocabulary-scroll');

  for (let i = 0; i < 10; i++) {
    await go('/review');
    if (await locate('Vrai ou faux ?')) break;
  }
  await snap('40-review');
} catch (e) {
  console.error(e.message);
  await page.screenshot({ path: OUT + 'zz-error.png' });
} finally {
  writeFileSync(OUT + 'texts.md', log.join('\n'));
  await browser.close();
}
