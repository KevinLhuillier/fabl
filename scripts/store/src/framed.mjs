/**
 * Store screenshots in a phone, under a title: each capture of out/<lang>/ (taken by
 * screenshots.mjs) drawn into a phone on the brand background, with its title from
 * listing/<lang>/screenshots.json ("**word**" is highlighted, "\n" breaks the line).
 *
 * Usage: npm run store-frames [-- <lang>...]   → out/<lang>/framed/<name>.png (1080 × 1920)
 */
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import puppeteer from 'puppeteer-core';

import { LISTING_DIR, OUT_DIR, chromePath, selectedLangs } from './common.mjs';

const W = 1080;
const H = 1920;
/** Screen inside the phone: the 9:16 capture scaled down, under a status bar. */
const SCREEN_W = 740;
const BEZEL = 22;
/** Fake status bar above the capture (the web captures have none): the camera sits in it. */
const STATUS_H = 64;
/** The whole capture fits under it. */
const SCREEN_H = STATUS_H + Math.round((SCREEN_W * 1920) / 1080);
const PHONE_TOP = H - SCREEN_H - BEZEL * 2 - 90;

const escape = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const title = (s) =>
  escape(s)
    .replace(/\*\*([\s\S]+?)\*\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br>');

function frameHtml(heading, capture) {
  return `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Nunito:wght@800;900&display=swap" rel="stylesheet">
<style>
*{margin:0;box-sizing:border-box}
html,body{width:${W}px;height:${H}px;overflow:hidden}
body{font-family:Nunito,sans-serif;background:linear-gradient(160deg,#8E6CFF 0%,#6C3BE0 55%,#4E14A0 100%);position:relative}
.blob{position:absolute;border-radius:50%;background:#fff}
.b1{width:620px;height:620px;opacity:.07;right:-220px;top:-200px}
.b2{width:420px;height:420px;opacity:.06;left:-180px;top:820px}
.b3{width:300px;height:300px;opacity:.05;right:-90px;bottom:120px}
.head{position:absolute;left:70px;right:70px;top:0;height:${PHONE_TOP}px;display:flex;align-items:center;justify-content:center}
h1{text-align:center;color:#fff;
  font-weight:900;font-size:82px;line-height:1.12;letter-spacing:-.5px;text-shadow:0 6px 0 rgba(40,8,110,.35)}
h1 em{font-style:normal;color:#FFC233}
.phone{position:absolute;left:${(W - SCREEN_W) / 2 - BEZEL}px;top:${PHONE_TOP}px;
  width:${SCREEN_W + BEZEL * 2}px;height:${SCREEN_H + BEZEL * 2}px;padding:${BEZEL}px;border-radius:96px;
  background:#16131f;box-shadow:0 40px 80px rgba(30,6,80,.55), inset 0 0 0 3px #3a3550, inset 0 0 0 6px #16131f}
.screen{width:${SCREEN_W}px;height:${SCREEN_H}px;border-radius:76px;overflow:hidden;position:relative;background:#fff}
.screen img{width:100%;display:block}
.status{height:${STATUS_H}px;display:flex;align-items:center;justify-content:space-between;padding:6px 58px 0;font-weight:800;font-size:26px}
.status .icons{display:flex;gap:10px;align-items:center}
.bat{width:40px;height:20px;border-radius:5px;border:3px solid currentColor;position:relative;padding:2px}
.bat i{display:block;width:70%;height:100%;border-radius:2px;background:currentColor}
.sig{display:flex;gap:3px;align-items:flex-end;height:20px}.sig i{width:5px;border-radius:2px;background:currentColor}
.cam{position:absolute;left:50%;top:${(STATUS_H - 30) / 2 + 3}px;width:30px;height:30px;margin-left:-15px;border-radius:50%;background:#0b0a10;box-shadow:inset 0 0 0 4px #1f1c2b}
.btn{position:absolute;width:8px;border-radius:4px;background:#2a2638}
.power{right:-6px;top:300px;height:130px}.vol{right:-6px;top:470px;height:200px}
</style></head><body>
<div class="blob b1"></div><div class="blob b2"></div><div class="blob b3"></div>
<div class="head"><h1>${title(heading)}</h1></div>
<div class="phone"><div class="btn power"></div><div class="btn vol"></div>
<div class="screen" id="screen"><div class="status" id="status"><span>9:41</span><span class="icons"><span class="sig"><i style="height:8px"></i><i style="height:12px"></i><i style="height:16px"></i><i style="height:20px"></i></span><span class="bat"><i></i></span></span></div><img id="capture" src="${capture}"><div class="cam"></div></div></div>
</body></html>`;
}

const langs = selectedLangs(process.argv.slice(2));
const browser = await puppeteer.launch({ executablePath: chromePath(), headless: true });
const page = await browser.newPage();
await page.setViewport({ width: W, height: H });

try {
  for (const lang of langs) {
    const titles = JSON.parse(readFileSync(join(LISTING_DIR, lang, 'screenshots.json'), 'utf8'));
    mkdirSync(join(OUT_DIR, lang, 'framed'), { recursive: true });
    for (const [name, heading] of Object.entries(titles)) {
      const path = join(OUT_DIR, lang, `${name}.png`);
      if (!existsSync(path)) {
        console.warn(`out/${lang}/${name}.png missing: run npm run store-screenshots first.`);
        continue;
      }
      const capture = `data:image/png;base64,${readFileSync(path).toString('base64')}`;
      await page.setContent(frameHtml(heading, capture), { waitUntil: 'load' });
      await page.evaluate(() => document.fonts.ready);
      // The status bar takes the color of the capture's top edge, its text dark or light.
      await page.evaluate(() => {
        const img = document.getElementById('capture');
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = 4;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const [r, g, b] = ctx.getImageData(Math.floor(img.naturalWidth / 2), 1, 1, 1).data;
        const bar = document.getElementById('status');
        document.getElementById('screen').style.background = `rgb(${r},${g},${b})`;
        bar.style.color = 0.299 * r + 0.587 * g + 0.114 * b > 140 ? '#25223A' : '#ffffff';
      });
      await page.screenshot({ path: join(OUT_DIR, lang, 'framed', `${name}.png`) });
      console.log(`out/${lang}/framed/${name}.png`);
    }
  }
} finally {
  await browser.close();
}
