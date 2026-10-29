// Generates the site's HTML pages in every language from _src/content/*.mjs.
// French lives at the root (URLs already given to Google Play), the other
// languages under /<code>. Run: node apps/site/_src/build.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import fr from './content/fr.mjs';
import en from './content/en.mjs';
import es from './content/es.mjs';
import de from './content/de.mjs';
import it from './content/it.mjs';
import pt from './content/pt.mjs';

const ORIGIN = 'https://fabl-site.vercel.app';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const LANGS = [fr, en, es, de, it, pt];
const PAGES = ['home', 'privacy', 'contact', 'legal', 'deletion'];

/** Shared by every language. */
const company = {
  name: 'Kevin Lhuillier',
  siret: '901 311 902 00026',
  address: "62 allée de la Corolle, 59650 Villeneuve-d'Ascq",
  email: 'taleway.app@gmail.com',
};

const prefix = (l) => (l.code === 'fr' ? '' : `/${l.code}`);

function url(l, page) {
  const slug = l.slugs[page];
  return slug ? `${prefix(l)}/${slug}` : prefix(l) || '/';
}

function file(l, page) {
  return join(ROOT, prefix(l), `${l.slugs[page] || 'index'}.html`);
}

function render(l, page) {
  const p = l.pages[page];
  const u = Object.fromEntries(PAGES.map((key) => [key, url(l, key)]));
  const alternates = LANGS.map(
    (o) => `    <link rel="alternate" hreflang="${o.code}" href="${ORIGIN}${url(o, page)}" />`,
  )
    .concat(`    <link rel="alternate" hreflang="x-default" href="${ORIGIN}${url(en, page)}" />`)
    .join('\n');
  const langs = LANGS.map(
    (o) =>
      `<a href="${url(o, page)}" hreflang="${o.code}" lang="${o.code}" title="${o.name}"${
        o === l ? ' aria-current="page"' : ''
      }>${o.code.toUpperCase()}</a>`,
  ).join('');
  const verification =
    l.code === 'fr' && page === 'home'
      ? '\n    <meta name="google-site-verification" content="WOW7FAAcDZXQlHICTPu9-qziDt0kELmx7pw4z3ytflg" />'
      : '';
  const description = p.description
    ? `\n    <meta name="description" content="${p.description}" />`
    : '';

  return `<!doctype html>
<html lang="${l.code}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />${verification}
    <title>${p.title}</title>${description}
${alternates}
    <link rel="icon" href="/favicon.png" />
    <link rel="stylesheet" href="/styles.css" />
  </head>
  <body>
    <header>
      <div class="wrap">
        <a class="brand" href="${u.home}"><img src="/icon.png" alt="" />Taleway</a>
        <div class="header-end">
          <nav class="links">
            <a href="${u.privacy}">${l.ui.privacy}</a>
            <a href="${u.contact}">${l.ui.contact}</a>
          </nav>
          <nav class="langs" aria-label="${l.ui.language}">${langs}</nav>
        </div>
      </div>
    </header>

    <main>
${p.body(u, company).trim().replace(/^/gm, '      ')}
    </main>

    <footer>
      <div class="wrap">
        <span>© 2026 Taleway</span>
        <a href="${u.legal}">${l.ui.legal}</a>
        <a href="${u.privacy}">${l.ui.privacyPolicy}</a>
        <a href="${u.deletion}">${l.ui.deletion}</a>
        <a href="${u.contact}">${l.ui.contact}</a>
      </div>
    </footer>
  </body>
</html>
`;
}

for (const l of LANGS) {
  for (const page of PAGES) {
    const path = file(l, page);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, render(l, page));
  }
}
console.log(`${LANGS.length * PAGES.length} pages written.`);
