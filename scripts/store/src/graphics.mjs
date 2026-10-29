/**
 * Store graphics: the 512 px icon and, per language, the 1024x500 feature graphic
 * (texts from listing/<lang>/feature.json).
 *
 * Usage: npm run store-graphics [-- <lang>...]
 */
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import puppeteer from 'puppeteer-core';

import { APP_ICON, LISTING_DIR, OUT_DIR, chromePath, selectedLangs } from './common.mjs';

const escape = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const icon = `data:image/png;base64,${readFileSync(APP_ICON).toString('base64')}`;

function featureHtml({ headline, subtitle, translation }) {
  return `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Nunito:wght@600;700;800;900&display=swap" rel="stylesheet">
<style>
*{margin:0;box-sizing:border-box}
html,body{width:1024px;height:500px;overflow:hidden}
body{font-family:Nunito,sans-serif;background:#6C4BF4;color:#fff;position:relative}
.blob{position:absolute;border-radius:50%}
.b1{width:420px;height:420px;background:#7d60f6;right:-90px;top:-140px}
.b2{width:260px;height:260px;background:#5a39e6;left:-80px;bottom:-120px}
.left{position:absolute;left:64px;top:0;bottom:0;width:520px;display:flex;flex-direction:column;justify-content:center}
.brand{display:flex;align-items:center;gap:16px;margin-bottom:26px}
.brand img{width:64px;height:64px;border-radius:16px;box-shadow:0 5px 0 #4F31C9}
.brand span{font-size:34px;font-weight:900;letter-spacing:.5px}
h1{font-size:50px;line-height:1.08;font-weight:900}
p{margin-top:20px;font-size:21px;font-weight:700;color:#EEE9FF}
.card{position:absolute;right:70px;top:120px;width:330px;background:#fff;color:#2b2540;border-radius:26px;padding:30px 26px 26px;box-shadow:0 10px 0 #4F31C9;transform:rotate(3deg)}
.lvl{position:absolute;right:20px;top:18px;background:#21C998;color:#fff;font-weight:900;font-size:15px;border-radius:10px;padding:3px 10px}
.txt{padding-right:34px;font-size:22px;line-height:1.5;font-weight:700}
.w{position:relative;background:#FFC233;border-radius:8px;padding:0 5px}
.tip{position:absolute;left:50%;bottom:calc(100% + 12px);transform:translateX(-50%);white-space:nowrap;line-height:1.2;box-shadow:0 4px 0 rgba(0,0,0,.15);background:#2b2540;color:#fff;font-weight:800;font-size:18px;border-radius:12px;padding:7px 14px}
.tip:after{content:"";position:absolute;left:calc(50% - 8px);bottom:-8px;border:8px solid transparent;border-bottom:0;border-top-color:#2b2540}
.bar{margin-top:18px;height:10px;border-radius:5px;background:#EEE9FF;overflow:hidden}.bar i{display:block;width:62%;height:100%;background:#6C4BF4}
.fire{position:absolute;right:46px;bottom:52px;background:#FF6B5B;color:#fff;font-weight:900;font-size:20px;border-radius:16px;padding:10px 16px;box-shadow:0 5px 0 #d94a3b;transform:rotate(-4deg)}
</style></head><body>
<div class="blob b1"></div><div class="blob b2"></div>
<div class="left"><div class="brand"><img src="${icon}"><span>Taleway</span></div>
<h1>${escape(headline).replace(/\n/g, '<br>')}</h1><p>${escape(subtitle)}</p></div>
<div class="card"><span class="lvl">B1</span><div class="txt">She <span class="w">whispered<span class="tip">${escape(translation)}</span></span>: "Don't look back." And the door slowly opened…</div><div class="bar"><i></i></div></div>
<div class="fire">🔥 7</div>
</body></html>`;
}

const langs = selectedLangs(process.argv.slice(2));
mkdirSync(OUT_DIR, { recursive: true });
const browser = await puppeteer.launch({ executablePath: chromePath(), headless: true });
const page = await browser.newPage();

await page.setViewport({ width: 512, height: 512 });
await page.setContent(`<body style="margin:0"><img src="${icon}" width="512" height="512">`);
await page.screenshot({ path: join(OUT_DIR, 'icon-512.png') });
console.log('out/icon-512.png');

await page.setViewport({ width: 1024, height: 500 });
for (const lang of langs) {
  const texts = JSON.parse(readFileSync(join(LISTING_DIR, lang, 'feature.json'), 'utf8'));
  await page.setContent(featureHtml(texts), { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  mkdirSync(join(OUT_DIR, lang), { recursive: true });
  await page.screenshot({ path: join(OUT_DIR, lang, 'feature-graphic.png') });
  console.log(`out/${lang}/feature-graphic.png`);
}
await browser.close();
