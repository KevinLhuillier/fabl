// Étape 2 : filme chaque scène de l'appli web dans un clip séparé (clips/<n>-<nom>.mp4).
// Images capturées en CDP screencast (390x844 @3x), assemblées à 60 i/s par ffmpeg.
// Un fichier clips/<n>-<nom>.json donne les instants des taps et du début de l'audio.
// La main et les défilements sont animés dans la page (requestAnimationFrame) : chaque
// image affichée bouge, quelle que soit la latence de Playwright.
// Usage : node record.mjs [library reader listen review]
import { chromium } from 'playwright';
import ffmpeg from 'ffmpeg-static';
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const APP = process.env.APP_URL ?? 'http://localhost:8082';
const DIR = fileURLToPath(new URL('.', import.meta.url));
const CLIPS = DIR + 'clips/';
const STATE = DIR + 'auth-state.json';
const FPS = 60;
const W = 390;
const H = 844;
mkdirSync(CLIPS, { recursive: true });

/**
 * Calque des gestes, injecté dans la page : une main blanche qui pointe (pointe de l'index
 * = point touché), un cercle à chaque tap, et des animations à la cadence de l'écran.
 */
const GESTURE_LAYER = () => {
  // Pointe de l'index dans l'image de la main (px), et taille de la main.
  const SIZE = 56;
  const TIP = { x: (8 / 24) * SIZE, y: (2.3 / 24) * SIZE };
  const HAND_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${SIZE}" height="${SIZE}">
    <path d="M6 4a2 2 0 0 1 4 0v5.5a2 2 0 0 1 4 0v.5a2 2 0 0 1 4 0v1a2 2 0 0 1 4 0v3a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L6 15Z"
      fill="#fff" stroke="#25223A" stroke-width="1.25" stroke-linejoin="round"/>
    <path d="M10 9.5v3M14 10v2.6M18 11v2" stroke="#25223A" stroke-width="1.1" stroke-linecap="round" fill="none"/>
  </svg>`;
  const css = `
    ::-webkit-scrollbar{display:none} *{scrollbar-width:none}
    *:focus,*:focus-visible{outline:none!important}
    #pub-hand{position:fixed;left:0;top:0;z-index:2147483647;pointer-events:none;
      width:${SIZE}px;height:${SIZE}px;opacity:0;transition:opacity .25s;
      transform-origin:${TIP.x}px ${TIP.y}px;filter:drop-shadow(0 3px 6px rgba(20,10,60,.35))}
    #pub-hand.on{opacity:1}
    .pub-ripple{position:fixed;z-index:2147483646;pointer-events:none;width:44px;height:44px;
      margin:-22px 0 0 -22px;border-radius:50%;border:3px solid #6C4BF4;
      background:rgba(108,75,244,.25);animation:pub-ripple .6s ease-out forwards}
    @keyframes pub-ripple{from{transform:scale(.6);opacity:1}to{transform:scale(2.2);opacity:0}}`;
  const hand = { x: -200, y: -200, scale: 1, el: null };
  const draw = () => {
    if (hand.el)
      hand.el.style.transform = `translate(${hand.x - TIP.x}px, ${hand.y - TIP.y}px) scale(${hand.scale})`;
  };
  const install = () => {
    if (document.getElementById('pub-hand')) return;
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
    hand.el = document.createElement('div');
    hand.el.id = 'pub-hand';
    hand.el.innerHTML = HAND_SVG;
    document.body.appendChild(hand.el);
    draw();
    addEventListener(
      'pointerdown',
      (e) => {
        hand.x = e.clientX;
        hand.y = e.clientY;
        hand.scale = 0.88;
        draw();
        const r = document.createElement('div');
        r.className = 'pub-ripple';
        r.style.left = e.clientX + 'px';
        r.style.top = e.clientY + 'px';
        document.body.appendChild(r);
        setTimeout(() => r.remove(), 700);
        window.__pub.taps.push(Date.now());
      },
      true,
    );
    addEventListener('pointerup', () => ((hand.scale = 1), draw()), true);
  };
  const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
  /** Anime `step(p)` de 0 à 1 en `ms`, une fois par image. */
  const animate = (ms, step) =>
    new Promise((done) => {
      const t0 = performance.now();
      const frame = (now) => {
        const p = Math.min(1, (now - t0) / ms);
        step(p);
        if (p < 1) requestAnimationFrame(frame);
        else done();
      };
      requestAnimationFrame(frame);
    });
  /** Élément défilant sous le point (x, y). */
  const scroller = (x, y) => {
    for (let e = document.elementFromPoint(x, y); e; e = e.parentElement) {
      const o = getComputedStyle(e).overflowY;
      if ((o === 'auto' || o === 'scroll') && e.scrollHeight > e.clientHeight + 4) return e;
    }
    return document.scrollingElement;
  };
  window.__pub = { taps: [], audio: [] };
  window.__hand = {
    show(on) {
      hand.el?.classList.toggle('on', on);
    },
    place(x, y) {
      hand.x = x;
      hand.y = y;
      draw();
    },
    /** Déplacement en légère courbe, comme un vrai doigt. */
    moveTo(x, y, ms) {
      const fx = hand.x;
      const fy = hand.y;
      return animate(ms, (p) => {
        const k = ease(p);
        hand.x = fx + (x - fx) * k + Math.sin(Math.PI * p) * 14;
        hand.y = fy + (y - fy) * k;
        draw();
      });
    },
    /** Glissé vers le haut : la main monte de `rise` px pendant que la liste défile de `dy`
     *  (`'end'` : jusqu'en bas de la liste). */
    swipe(x, y, dy, rise, ms) {
      const el = scroller(x, y);
      const top = el.scrollTop;
      if (dy === 'end') dy = el.scrollHeight - el.clientHeight - top;
      return animate(ms, (p) => {
        const k = ease(p);
        el.scrollTop = top + dy * k;
        hand.x = x;
        hand.y = y - rise * k;
        draw();
      });
    },
  };
  // Début réel de la lecture audio, pour caler la narration sur le surlignage au montage.
  const play = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function (...a) {
    this.addEventListener(
      'playing',
      () => window.__pub.audio.push({ t: Date.now(), src: this.currentSrc, pos: this.currentTime }),
      { once: true },
    );
    return play.apply(this, a);
  };
  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', install);
  else install();
};

const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({
  viewport: { width: W, height: H },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  locale: 'fr-FR',
  storageState: STATE,
});
await ctx.addInitScript(GESTURE_LAYER);
const page = await ctx.newPage();
const sleep = (ms) => page.waitForTimeout(ms);
const mouse = { x: W * 0.75, y: H + 40 };

// ---------- navigation ----------

async function locate(label, { scroll = true } = {}) {
  return page.evaluate(
    ([t, scroll]) => {
      const els = [...document.querySelectorAll('body *')].filter((e) => e.offsetParent !== null);
      const clean = (s) => s.trim().replace(/[.,;:!?]+$/, '');
      const el =
        els.find((e) => e.childElementCount === 0 && e.textContent.trim() === t) ??
        els.find((e) => e.childElementCount === 0 && clean(e.textContent) === t) ??
        els.find((e) => e.getAttribute('aria-label') === t);
      if (!el) return null;
      if (scroll) el.scrollIntoView({ block: 'center' });
      const r = el.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    },
    [label, scroll],
  );
}

/** Clic immédiat (préparation hors caméra). */
async function click(label, after = 2500) {
  const at = await locate(label);
  if (!at) throw new Error(`"${label}" introuvable sur ${page.url()}`);
  await page.mouse.click(at.x, at.y, { delay: 80 });
  mouse.x = at.x;
  mouse.y = at.y;
  await sleep(after);
}

async function skipTour() {
  for (let i = 0; i < 4 && (await locate('Passer', { scroll: false })); i++) await click('Passer', 1000);
}

async function go(path) {
  await page.goto(APP + path, { waitUntil: 'domcontentloaded', timeout: 120000 });
  for (let i = 0; i < 60; i++) {
    if ((await page.evaluate(() => document.body.innerText.trim().length)) > 30) break;
    await sleep(1000);
  }
  await sleep(3500);
  await skipTour();
}

// ---------- gestes filmés (lents) ----------

const hand = (fn, ...args) =>
  page.evaluate(([fn, args]) => window.__hand[fn](...args), [fn, args]);

async function moveTo(x, y, ms = 900) {
  await hand('moveTo', x, y, ms);
  mouse.x = x;
  mouse.y = y;
}

/** La main arrive depuis le bas de l'écran. */
async function fingerIn(x, y, ms = 900) {
  await hand('place', x + 60, H + 40);
  await hand('show', true);
  mouse.x = x + 60;
  mouse.y = H + 40;
  await moveTo(x, y, ms);
}

async function fingerOut(ms = 700) {
  await moveTo(mouse.x + 50, H + 60, ms);
  await hand('show', false);
}

/** Tap filmé : la main va au point, appuie, relâche (vrai clic souris pour l'appli). */
async function tapAt(x, y, moveMs = 900) {
  await moveTo(x, y, moveMs);
  await sleep(200);
  await page.mouse.move(x, y);
  await page.mouse.down();
  await sleep(120);
  await page.mouse.up();
}

/** Glissé doux vers le haut : la liste défile de `distance` px en `ms`. */
async function swipe(distance, ms = 2500, x = W * 0.62) {
  const startY = H * 0.74;
  await fingerIn(x, startY, 600);
  await sleep(150);
  await hand('swipe', x, startY, distance, H * 0.4, ms);
  mouse.x = x;
  mouse.y = startY - H * 0.4;
  await sleep(100);
  await fingerOut(450);
}

// ---------- capture ----------

let cdp;
let frames = [];
async function startCapture() {
  frames = [];
  await page.evaluate(() => {
    window.__pub.taps = [];
    window.__pub.audio = [];
  });
  cdp = await ctx.newCDPSession(page);
  cdp.on('Page.screencastFrame', async ({ data, metadata, sessionId }) => {
    frames.push({ t: metadata.timestamp, data });
    await cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
  });
  await cdp.send('Page.startScreencast', {
    format: 'jpeg',
    quality: 95,
    maxWidth: W * 3,
    maxHeight: H * 3,
    everyNthFrame: 1,
  });
  // Une première image même si rien ne bouge.
  await page.evaluate(() => document.body.style.setProperty('--pub', String(Math.random())));
  await sleep(300);
}

/** Arrête la capture et écrit le clip à fréquence constante + ses repères. */
async function stopCapture(name) {
  // Une image tout de suite avant l'arrêt, pour fixer la durée de la fin du clip.
  const endT = Date.now() / 1000;
  await cdp.send('Page.stopScreencast');
  await cdp.detach();
  const marks = await page.evaluate(() => window.__pub);
  if (!frames.length) throw new Error(`${name} : aucune image capturée`);

  const t0 = frames[0].t;
  const tmp = CLIPS + `.tmp-${name}/`;
  rmSync(tmp, { recursive: true, force: true });
  mkdirSync(tmp, { recursive: true });
  let list = '';
  frames.forEach((f, i) => {
    const file = `f${String(i).padStart(5, '0')}.jpg`;
    writeFileSync(tmp + file, Buffer.from(f.data, 'base64'));
    const next = i + 1 < frames.length ? frames[i + 1].t : endT;
    list += `file '${file}'\nduration ${Math.max(0.001, next - f.t).toFixed(4)}\n`;
  });
  list += `file 'f${String(frames.length - 1).padStart(5, '0')}.jpg'\n`;
  writeFileSync(tmp + 'list.txt', list);
  execFileSync(
    ffmpeg,
    [
      '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', 'list.txt',
      '-vf', `fps=${FPS},scale=${W * 3}:${H * 3}:flags=lanczos,format=yuv420p`,
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '14', '-movflags', '+faststart',
      `../${name}.mp4`,
    ],
    { cwd: tmp },
  );
  rmSync(tmp, { recursive: true, force: true });

  const rel = (ms) => +(ms / 1000 - t0).toFixed(3);
  const info = {
    duration: +(endT - t0).toFixed(3),
    frames: frames.length,
    avgFps: +(frames.length / (endT - t0)).toFixed(1),
    taps: marks.taps.map(rel),
    audio: marks.audio.map((a) => ({ t: rel(a.t), src: a.src, pos: a.pos })),
  };
  writeFileSync(CLIPS + `${name}.json`, JSON.stringify(info, null, 2));
  console.log(`${name}.mp4`, JSON.stringify(info));
}

// ---------- scènes ----------

/** Chapitre 1 de The Quiet Signal, page 2 (« when someone told a lie »). */
async function openReader() {
  await go('/');
  await click('The Quiet Signal', 4000);
  await skipTour();
  await click('A Normal Morning', 6000);
  await skipTour();
  for (let i = 0; i < 12 && !(await locate('nine', { scroll: false })); i++) {
    const prev = (await locate('Page précédente', { scroll: false })) ?? null;
    const isFirst = await locate('alarm', { scroll: false });
    await click(isFirst ? 'Page suivante' : prev ? 'Page précédente' : 'Page suivante', 2500);
  }
  if (!(await locate('nine', { scroll: false }))) throw new Error('page 2 du chapitre 1 introuvable');
  await page.evaluate(() => scrollTo(0, 0));
  await sleep(1500);
}

const FILL = 'Complète la phrase de l’histoire';
const SUPABASE_WRITES = /supabase\.co\/(rest|functions)\/v1\//;

const scenes = {
  async library() {
    await go('/');
    await sleep(5000); // cartes « Continuer la lecture » et « mots à réviser » chargées
    // Couvertures préchargées : défilement jusqu'en bas puis retour, hors caméra.
    await page.mouse.move(W / 2, H / 2);
    for (let i = 0; i < 8; i++) await page.mouse.wheel(0, 500), await sleep(500);
    await sleep(2000);
    for (let i = 0; i < 8; i++) await page.mouse.wheel(0, -600), await sleep(200);
    await sleep(2000);
    await startCapture();
    await sleep(1500);
    // Deux glissés lents, comme on parcourt une bibliothèque.
    await swipe(1300, 4200);
    await sleep(500);
    await swipe('end', 4200);
    await sleep(1600);
    await stopCapture('1-library');
  },

  async reader() {
    await openReader();
    await startCapture();
    await sleep(1800);
    const at = await locate('lie', { scroll: false });
    await fingerIn(at.x + 40, at.y + 150, 1300);
    await sleep(500);
    await tapAt(at.x, at.y, 700);
    await sleep(500);
    await fingerOut(700);
    await sleep(5000);
    await stopCapture('2-reader');
    await page.keyboard.press('Escape');
  },

  async listen() {
    await openReader();
    await startCapture();
    await sleep(1500);
    const at = await locate('Écouter la page', { scroll: false });
    await fingerIn(at.x - 10, at.y - 100, 1000);
    await tapAt(at.x, at.y, 500);
    await sleep(300);
    await fingerOut(700);
    await sleep(12500);
    await stopCapture('3-listen');
    await page.mouse.click(at.x, at.y); // pause
  },

  /** Révision : un clip Vrai/Faux (4a) et un clip phrase à trous (4b), pris dans les séances. */
  async review() {
    // Rien n'est enregistré sur le compte : écritures Supabase simulées.
    await page.route(SUPABASE_WRITES, (route) => {
      const m = route.request().method();
      // Lectures : GET, et la RPC des phrases d'histoire (POST) sans quoi pas de phrase à trous.
      if (m === 'GET' || m === 'HEAD' || route.request().url().includes('/rpc/vocabulary_occurrences'))
        return route.continue();
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
    const done = new Set(process.env.SKIP_TF ? ['tf'] : []);
    // Types d'exercices tirés au hasard : on recharge une séance neuve toutes les 15 étapes.
    for (let session = 0; session < 12 && done.size < 2; session++) {
      await go('/review');
      for (let step = 0; step < 15 && done.size < 2; step++) {
        if (process.env.DEBUG)
          console.log(session, step, (await page.evaluate(() => document.body.innerText)).slice(0, 90).replace(/\n/g, ' | '));
        if (!done.has('tf') && (await locate('Vrai ou faux ?', { scroll: false }))) {
          await recordTrueFalse();
          done.add('tf');
        } else if (!done.has('fill') && (await locate(FILL, { scroll: false }))) {
          await recordFill();
          done.add('fill');
        } else if (await locate('Continuer', { scroll: false })) {
          await click('Continuer', 2000);
        } else if (await locate('Associe chaque mot à sa traduction', { scroll: false })) {
          await solvePairs();
        } else if (await locate('Je ne sais pas', { scroll: false })) {
          await click('Je ne sais pas', 1500);
        } else if (await locate('Vrai ou faux ?', { scroll: false })) {
          await sleep(6500); // Vrai/Faux déjà filmé : on laisse le chrono finir
        } else {
          await sleep(1000);
        }
      }
    }
    await page.unroute(SUPABASE_WRITES);
    if (done.size < 2) throw new Error(`révision : seulement ${[...done]} filmé(s)`);
  },
};

async function recordTrueFalse() {
  // 1re affirmation répondue hors caméra : on filme la 2e avec son chrono plein.
  await click((await trueFalseAnswer()) ? 'Vrai' : 'Faux', 0);
  for (let i = 0; i < 40 && !(await page.evaluate(() => document.body.innerText.includes('2 / '))); i++)
    await sleep(50);
  await startCapture();
  await sleep(900);
  const right = await trueFalseAnswer();
  const yes = await locate('Vrai', { scroll: false });
  const no = await locate('Faux', { scroll: false });
  const [wrongBtn, rightBtn] = right ? [no, yes] : [yes, no];
  await fingerIn(W / 2, wrongBtn.y + 30, 500);
  await moveTo(wrongBtn.x, wrongBtn.y - 4, 400);
  await sleep(400);
  await moveTo(rightBtn.x, rightBtn.y - 4, 450);
  await sleep(350);
  await moveTo(wrongBtn.x + 15, wrongBtn.y, 400);
  await sleep(250);
  await tapAt(rightBtn.x, rightBtn.y, 450);
  await sleep(300);
  await fingerOut(400);
  await sleep(1500);
  await stopCapture('4a-truefalse');
  // Les autres affirmations : réponses justes, hors caméra.
  for (let i = 0; i < 6 && !(await locate('Continuer', { scroll: false })); i++) {
    if (await locate('Vrai', { scroll: false })) await click((await trueFalseAnswer()) ? 'Vrai' : 'Faux', 1200);
    else await sleep(800);
  }
}

async function recordFill() {
  const answer = await page.evaluate((src) => {
    const find = new Function('return ' + src)();
    const f = find('div', "p.ex && typeof p.ex.answer === 'string' && p.ex.kind !== 'trueFalse'");
    return f ? f.memoizedProps.ex.answer.split(',')[0].trim() : null;
  }, FIBER_PROPS.toString());
  if (!answer) throw new Error('réponse de la phrase à trous introuvable');
  await startCapture();
  await sleep(1800);
  const input = await page.evaluate(() => {
    const r = document.querySelector('input, textarea').getBoundingClientRect();
    return { x: r.x + r.width * 0.3, y: r.y + r.height / 2 };
  });
  await fingerIn(input.x + 30, input.y + 140, 900);
  await tapAt(input.x, input.y, 500);
  await sleep(200);
  await moveTo(input.x + 150, input.y + 170, 500);
  await page.keyboard.type(answer, { delay: 170 });
  await sleep(500);
  const ok = await locate('Valider', { scroll: false });
  await tapAt(ok.x, ok.y, 600);
  await sleep(300);
  await fingerOut(600);
  await sleep(2600);
  await stopCapture('4b-fill');
}

/** Props React du composant qui contient `node` et dont les props passent `test`. */
const FIBER_PROPS = (sel, testSrc) => {
  const test = new Function('p', `return ${testSrc}`);
  for (const el of document.querySelectorAll(sel)) {
    const key = Object.keys(el).find((k) => k.startsWith('__reactFiber$'));
    for (let f = el[key]; f; f = f.return) if (f.memoizedProps && test(f.memoizedProps)) return f;
  }
  return null;
};

async function solvePairs() {
  const tiles = await page.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll('[role="button"]')) {
      if (el.offsetParent === null) continue;
      const key = Object.keys(el).find((k) => k.startsWith('__reactFiber$'));
      for (let f = el[key]; f; f = f.return) {
        const m = typeof f.key === 'string' && f.key.match(/^(word|meaning)-(\d+)$/);
        if (m) {
          const r = el.getBoundingClientRect();
          out.push({ side: m[1], id: m[2], x: r.x + r.width / 2, y: r.y + r.height / 2 });
          break;
        }
      }
    }
    return out;
  });
  for (const w of tiles.filter((t) => t.side === 'word')) {
    const m = tiles.find((t) => t.side === 'meaning' && t.id === w.id);
    if (!m) continue;
    await page.mouse.click(w.x, w.y);
    await sleep(250);
    await page.mouse.click(m.x, m.y);
    await sleep(450);
  }
  await sleep(1200);
}

/** Bonne réponse de l'affirmation affichée, lue dans l'état React de l'exercice. */
async function trueFalseAnswer() {
  return page.evaluate((src) => {
    const find = new Function('return ' + src)();
    const f = find('div', "p.ex && p.ex.kind === 'trueFalse'");
    if (!f) return true;
    const text = document.body.innerText;
    const s = f.memoizedProps.ex.statements.find(
      (s) => text.includes(s.item.word) && text.includes(s.shown),
    );
    return s ? s.isTrue : true;
  }, FIBER_PROPS.toString());
}

const wanted = process.argv.slice(2).filter((a) => !a.startsWith('-'));
try {
  for (const [name, run] of Object.entries(scenes)) {
    if (wanted.length && !wanted.includes(name)) continue;
    console.log('== ' + name);
    await run();
  }
} catch (e) {
  console.error(e);
  await page.screenshot({ path: CLIPS + 'zz-error.png' });
  process.exitCode = 1;
} finally {
  await browser.close();
}
