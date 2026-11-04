// Données du short « Séance de lecture en anglais » : les deux premières pages du chapitre 1
// de Write Back (B2), avec l'audio réel de l'appli et son alignement mot à mot.
//   public/short-lecture/page-<n>.mp3   audio de la page (même fichier que dans l'appli)
//   src/short-lecture-data.json        mots de chaque page (texte affiché, début, fin en s),
//                                      paragraphes, et mots touchés (traduction de l'appli)
// Usage : node short-lecture-data.mjs
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const DIR = fileURLToPath(new URL('.', import.meta.url));
const ROOT = DIR + '../';
const STORY = 'b2-write-back';
const OUT = DIR + 'public/short-lecture/';
mkdirSync(OUT, { recursive: true });

/**
 * Mots touchés, au plus 3 par page : le mot affiché (ou l'expression, plusieurs mots
 * consécutifs) et l'entrée du lexique de l'appli dont la traduction s'affiche.
 */
const TAPS = {
  1: [
    { text: 'out loud', entry: ['out loud', 'PHRASE'] },
    { text: 'whispered', entry: ['whisper', 'VERB'] },
    { text: 'proud of.', entry: ['be proud of', 'PHRASE'], label: 'proud of' },
  ],
  2: [
    { text: 'sheep', entry: ['sheep', 'NOUN'] },
    { text: 'in a row.', entry: ['in a row', 'PHRASE'], label: 'in a row', short: "d'affilée" },
    { text: 'suited', entry: ['suit', 'VERB'], short: 'convenir à' },
  ],
};
const POS_FR = { NOUN: 'nom', VERB: 'verbe', ADJ: 'adjectif', ADV: 'adverbe', PHRASE: 'expression' };

const md = readFileSync(ROOT + `content/stories/${STORY}.md`, 'utf8');
const chapterTitle = md.match(/^# (.+)$/m)[1];
const pageBlocks = md.split(/\r?\n---\r?\n/).filter((p) => p.includes('@audio'));
const alignment = JSON.parse(readFileSync(ROOT + `content/alignments/${STORY}.json`, 'utf8')).pages;
const lexicon = JSON.parse(readFileSync(ROOT + 'content/translations/fr.json', 'utf8')).entries;
const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

const pages = [];
for (const n of [1, 2]) {
  const key = `chapter_1.page_${n}`;
  const al = alignment[key].words; // [mot, début ms, fin ms]
  const paragraphs = pageBlocks[n - 1]
    .split(/\r?\n/)
    .filter((l) => l.trim() && !l.startsWith('@') && !l.startsWith('#'))
    .map((l) => l.trim().split(/\s+/));

  // Mots affichés ← mots alignés (un mot affiché peut en couvrir plusieurs : « grandad's »).
  let k = 0;
  const words = [];
  paragraphs.forEach((tokens, p) => {
    for (const text of tokens) {
      const want = norm(text);
      let got = '';
      const start = al[k][1];
      let end = al[k][2];
      while (k < al.length && got.length < want.length) {
        got += norm(al[k][0]);
        end = al[k][2];
        k++;
      }
      if (got !== want) throw new Error(`page ${n} : « ${text} » ≠ « ${got} »`);
      words.push({ text, start: start / 1000, end: end / 1000, p });
    }
  });

  const sentence = (i) => {
    const isEnd = (w) => /[.!?]["”]?$/.test(w.text);
    let a = i;
    while (a > 0 && !isEnd(words[a - 1])) a--;
    let b = i;
    while (b < words.length - 1 && !isEnd(words[b])) b++;
    return words
      .slice(a, b + 1)
      .map((w) => w.text)
      .join(' ');
  };

  const taps = TAPS[n].map((t) => {
    const parts = t.text.split(' ');
    const at = words.findIndex((_, i) => parts.every((p, j) => words[i + j]?.text === p));
    if (at < 0) throw new Error(`page ${n} : « ${t.text} » introuvable`);
    const e = lexicon.find((x) => x.word === t.entry[0] && x.pos === t.entry[1]);
    if (!e) throw new Error(`lexique : ${t.entry.join(' ')}`);
    return {
      words: parts.map((_, j) => at + j),
      label: t.label ?? t.text,
      pos: POS_FR[e.pos] ?? e.pos.toLowerCase(),
      translation: t.short ?? e.translation,
      context: sentence(at),
    };
  });

  const file = OUT + `page-${n}.mp3`;
  if (!existsSync(file)) {
    const res = await fetch(alignment[key].audio);
    if (!res.ok) throw new Error(`audio page ${n} : ${res.status}`);
    writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  }
  pages.push({ n, duration: words.at(-1).end, words, taps });
  console.log(`page ${n} : ${words.length} mots, ${words.at(-1).end.toFixed(1)} s`);
  for (const t of taps) console.log(`   ${t.label} [${t.pos}] → ${t.translation}`);
}

// ---------------------------------------------------------------------------
// Accueil et page de l'histoire : étagères (vraies couvertures) et sommaire
// ---------------------------------------------------------------------------

/** Texte lu d'un bloc d'histoire (sans les lignes @audio, titres et séparateurs). */
const prose = (text) =>
  text
    .split(/\r?\n/)
    .filter((l) => l.trim() && !l.startsWith('@') && !l.startsWith('#') && l.trim() !== '---')
    .join(' ')
    .split(/\s+/)
    .filter(Boolean);

function readStory(file) {
  const src = readFileSync(ROOT + 'content/stories/' + file, 'utf8');
  const front = src.match(/^---\r?\n([\s\S]*?)\r?\n---/)[1];
  const field = (k) => front.match(new RegExp(`^${k}: (.*)$`, 'm'))?.[1]?.trim();
  const body = src.slice(src.indexOf('---', 3) + 3);
  const chapters = body
    .split(/\r?\n# /)
    .slice(1)
    .map((c) => ({
      title: c.split(/\r?\n/)[0].trim(),
      pages: (c.match(/@audio/g) ?? []).length,
      words: prose(c.split(/\r?\n/).slice(1).join('\n')).length,
    }));
  return {
    slug: file.replace(/\.md$/, ''),
    title: field('title'),
    level: field('level'),
    summary: field('summary'),
    premium: field('premium') === 'true',
    cover: field('cover'),
    words: chapters.reduce((n, c) => n + c.words, 0),
    chapters,
  };
}

const stories = readdirSync(ROOT + 'content/stories')
  .filter((f) => f.endsWith('.md'))
  .map(readStory);
mkdirSync(OUT + 'covers', { recursive: true });
for (const st of stories) {
  const file = OUT + `covers/${st.slug}.webp`;
  if (st.cover && !existsSync(file)) {
    const res = await fetch(st.cover);
    if (res.ok) writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  }
}

// Étagères de l'accueil, comme l'appli : une par niveau, les histoires gratuites d'abord.
// Write Back est mise juste après la première, pour qu'elle soit visible sans défiler de côté.
const shelves = ['A2', 'B1', 'B2'].map((level) => {
  const list = stories
    .filter((st) => st.level === level)
    .sort((a, b) => Number(a.premium) - Number(b.premium));
  const wb = list.findIndex((st) => st.slug === STORY);
  if (wb > 1) list.splice(1, 0, ...list.splice(wb, 1));
  return {
    level,
    stories: list.map(({ slug, title, premium, words, chapters }) => ({
      slug,
      title,
      premium,
      words,
      chapters: chapters.length,
    })),
  };
});
const story = stories.find((st) => st.slug === STORY);

writeFileSync(
  DIR + 'src/short-lecture-data.json',
  JSON.stringify(
    {
      title: story.title,
      level: story.level,
      slug: STORY,
      summary: story.summary,
      words: story.words,
      chapters: story.chapters,
      chapterTitle,
      pageCount: story.chapters[0].pages,
      shelves,
      pages,
    },
    null,
    1,
  ) + '\n',
);
console.log(`${stories.length} couvertures, ${story.chapters.length} chapitres, ${story.words} mots`);
