/**
 * App icon: a white glyph on the brand gradient, drawn as SVG and rendered by Chrome.
 *
 *   node src/app-icon.mjs --preview          out/icon-preview.png: both variants side by side
 *   node src/app-icon.mjs --variant=letter   writes the app's icon files (apps/mobile/assets/images)
 *   node src/app-icon.mjs --variant=book
 *
 * Files written: icon.png (1024, full bleed: the stores round it), the Android adaptive icon
 * (gradient background + glyph foreground + monochrome glyph, the glyph inside the 66 % safe
 * zone), splash-icon.png (white glyph, also shown by the in-app launch screen) and favicon.png.
 */
import { readFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import puppeteer from 'puppeteer-core';

import { OUT_DIR, REPO_DIR, chromePath } from './common.mjs';

const IMAGES = join(REPO_DIR, 'apps', 'mobile', 'assets', 'images');
const SIZE = 1024;
/** apps/mobile/src/theme/colors.ts `brandGradient` (top left → bottom right). */
const GRADIENT = ['#8E6CFF', '#6C3BE0', '#4E14A0'];

const font = readFileSync(
  join(REPO_DIR, 'node_modules', '@expo-google-fonts', 'nunito', '900Black', 'Nunito_900Black.ttf'),
).toString('base64');

const defs = `
<defs>
  <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="${GRADIENT[0]}"/>
    <stop offset="0.5" stop-color="${GRADIENT[1]}"/>
    <stop offset="1" stop-color="${GRADIENT[2]}"/>
  </linearGradient>
  <radialGradient id="glow" cx="0.25" cy="0.2" r="0.75">
    <stop offset="0" stop-color="#fff" stop-opacity="0.22"/>
    <stop offset="1" stop-color="#fff" stop-opacity="0"/>
  </radialGradient>
  <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%">
    <feDropShadow dx="0" dy="14" stdDeviation="18" flood-color="#2A0870" flood-opacity="0.45"/>
  </filter>
</defs>`;

const background = `<rect width="${SIZE}" height="${SIZE}" fill="url(#bg)"/>
<rect width="${SIZE}" height="${SIZE}" fill="url(#glow)"/>`;

/** The glyph, white, centered, `scale` = its height as a share of the canvas. */
function glyph(variant, scale, { shadow = true, color = '#fff' } = {}) {
  const filter = shadow ? 'filter="url(#shadow)"' : '';
  if (variant === 'letter') {
    const fontSize = SIZE * scale * 1.38;
    // Nunito's T: cap height ≈ 0.705 em; baseline placed so the letter is optically centered.
    const baseline = SIZE / 2 + (fontSize * 0.705) / 2;
    return `<text x="${SIZE / 2}" y="${baseline}" text-anchor="middle" font-family="NunitoBlack"
      font-size="${fontSize}" fill="${color}" ${filter}>T</text>`;
  }
  // Lucide "book-open" (24 grid, content 20 × 18), thick rounded strokes.
  const k = (SIZE * scale) / 18;
  const tx = SIZE / 2 - 12 * k;
  const ty = SIZE / 2 - 12 * k;
  return `<g transform="translate(${tx} ${ty}) scale(${k})" ${filter} fill="none" stroke="${color}"
      stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">
    <path d="M12 7v14" />
    <path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" fill="${color}" fill-opacity="0.16"/>
  </g>`;
}

const svg = (body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">${defs}${body}</svg>`;

/** Glyph sizes: full icon, adaptive foreground (safe zone), splash. */
const SCALE = {
  letter: { icon: 0.56, adaptive: 0.4, splash: 0.26 },
  book: { icon: 0.5, adaptive: 0.36, splash: 0.36 },
};

const page = `<style>@font-face{font-family:NunitoBlack;src:url(data:font/ttf;base64,${font})}
body{margin:0;background:transparent}</style>`;

const browser = await puppeteer.launch({ executablePath: chromePath(), headless: true });
const tab = await browser.newPage();

async function render(html, path, { width = SIZE, height = SIZE, transparent = false } = {}) {
  await tab.setViewport({ width, height, deviceScaleFactor: 1 });
  await tab.setContent(`${page}${html}`);
  await tab.evaluate(() => document.fonts.ready);
  await tab.screenshot({ path, omitBackground: transparent, clip: { x: 0, y: 0, width, height } });
  console.log(path);
}

/** A 1024 SVG drawn at `px` × `px` into the app's images. */
async function renderSmall(markup, px, name, transparent = false) {
  const html = `<div style="width:${px}px;height:${px}px">${markup.replace(
    `width="${SIZE}" height="${SIZE}"`,
    `width="${px}" height="${px}"`,
  )}</div>`;
  await render(html, join(IMAGES, name), { width: px, height: px, transparent });
}

const args = process.argv.slice(2);
const variant = args.find((a) => a.startsWith('--variant='))?.split('=')[1];

if (args.includes('--preview')) {
  mkdirSync(OUT_DIR, { recursive: true });
  const icon = (v, shape) =>
    `<div class="icon ${shape}">${svg(background + glyph(v, SCALE[v].icon))}</div>`;
  const row = (v, label) => `<div class="col"><h2>${label}</h2>
    <div class="row">${icon(v, 'squircle')}${icon(v, 'circle')}</div>
    <div class="row small">${icon(v, 'squircle')}${icon(v, 'circle')}</div></div>`;
  await render(
    `<style>
      .wrap{width:1600px;height:900px;display:flex;gap:80px;align-items:center;justify-content:center;
        background:linear-gradient(160deg,#20263a,#0e1220);font-family:system-ui;color:#fff}
      .col{display:flex;flex-direction:column;align-items:center;gap:36px}
      h2{margin:0;font-size:34px;font-weight:600;opacity:.85}
      .row{display:flex;gap:40px;align-items:center}
      .icon{width:260px;height:260px;overflow:hidden;box-shadow:0 18px 40px rgba(0,0,0,.45)}
      .icon svg{width:100%;height:100%}
      .small .icon{width:96px;height:96px;box-shadow:0 6px 14px rgba(0,0,0,.45)}
      .squircle{border-radius:22.5%} .circle{border-radius:50%}
    </style>
    <div class="wrap">${row('letter', 'A · Lettre T')}${row('book', 'B · Livre ouvert')}</div>`,
    join(OUT_DIR, 'icon-preview.png'),
    { width: 1600, height: 900 },
  );
} else if (variant === 'letter' || variant === 'book') {
  const s = SCALE[variant];
  await render(svg(background + glyph(variant, s.icon)), join(IMAGES, 'icon.png'));
  await render(svg(background), join(IMAGES, 'android-icon-background.png'));
  await render(svg(glyph(variant, s.adaptive)), join(IMAGES, 'android-icon-foreground.png'), {
    transparent: true,
  });
  await render(
    svg(glyph(variant, s.adaptive, { shadow: false })),
    join(IMAGES, 'android-icon-monochrome.png'),
    { transparent: true },
  );
  await render(svg(glyph(variant, s.splash)), join(IMAGES, 'splash-icon.png'), {
    transparent: true,
  });
  // Favicon: the full icon, small.
  await renderSmall(svg(background + glyph(variant, s.icon)), 48, 'favicon.png');
  // Android notification icon (expo-notifications plugin): white glyph, transparent, 96 px.
  await renderSmall(svg(glyph(variant, 0.7, { shadow: false })), 96, 'notification-icon.png', true);
} else {
  console.error('Usage: node src/app-icon.mjs --preview | --variant=letter | --variant=book');
  process.exitCode = 1;
}

await browser.close();
