import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';

import { upsertTranslations } from '../../../scripts/publish/src/db.js';
import {
  analyzeStory,
  missingInTranslationFile,
  publishAnalysis,
  type StoryAnalysis,
} from '../../../scripts/publish/src/pipeline.js';
import { CEFR_LEVELS, type CefrLevel } from '../../../scripts/publish/src/story.js';
import { saveTranslations } from '../../../scripts/publish/src/translations.js';
import { lemmaKeyId } from '../../../scripts/publish/src/lemmatize.js';
import type { AnalysisReport, Lemma, ServerStatus, TranslationInput } from '../shared/api.js';
import {
  HttpError,
  checkSlug,
  createStoryFile,
  db,
  deleteStoryFile,
  getStory,
  importStoryFile,
  listStories,
  readStoryFile,
  requireDb,
  unpublishStory,
  uploadCover,
  writeStoryFile,
} from './stories.js';

/** Translation language of the app (TRANSLATION_LANG in apps/mobile). */
const LANG = process.env.ADMIN_LANG ?? 'fr';

export const api = new Hono().basePath('/api');

api.onError((e, c) => {
  if (e instanceof HttpError) return c.json({ error: e.message }, e.status);
  if (e instanceof HTTPException) return c.json({ error: e.message }, e.status);
  console.error(e);
  return c.json({ error: e instanceof Error ? e.message : String(e) }, 500);
});

api.get('/status', (c) => c.json<ServerStatus>({ supabase: !!db(), lang: LANG }));

api.get('/stories', async (c) => c.json(await listStories()));

api.post('/stories', async (c) => {
  const body = await c.req.json<{ slug: string; title: string; level: CefrLevel }>();
  if (!body.title?.trim()) throw new HttpError(400, 'Le titre est obligatoire.');
  if (!CEFR_LEVELS.includes(body.level)) throw new HttpError(400, 'Niveau invalide.');
  createStoryFile(checkSlug(body.slug), body.title.trim(), body.level);
  return c.json(await getStory(body.slug), 201);
});

api.get('/stories/:slug', async (c) => c.json(await getStory(c.req.param('slug'))));

/** Saves the file as is: a draft may still contain format errors (reported by "check"). */
api.put('/stories/:slug', async (c) => {
  const slug = c.req.param('slug');
  const { source } = await c.req.json<{ source: string }>();
  if (typeof source !== 'string') throw new HttpError(400, 'Contenu manquant.');
  writeStoryFile(slug, source);
  return c.json(await getStory(slug));
});

api.delete('/stories/:slug', async (c) => {
  const slug = checkSlug(c.req.param('slug'));
  // Online first: if it fails, the file is still there to retry.
  if (c.req.query('online') === '1') await unpublishStory(slug);
  if (c.req.query('file') === '1') deleteStoryFile(slug);
  return c.body(null, 204);
});

api.post('/stories/:slug/import', async (c) => {
  const slug = checkSlug(c.req.param('slug'));
  await importStoryFile(slug);
  return c.json(await getStory(slug));
});

/** Dry run: parse + lemmatize, missing translations from the translation file. */
api.post('/stories/:slug/check', async (c) => {
  const slug = checkSlug(c.req.param('slug'));
  const analysis = await analyze(slug);
  return c.json(report(analysis, false, missingInTranslationFile(analysis.lemmas, LANG)));
});

api.post('/stories/:slug/publish', async (c) => {
  const slug = checkSlug(c.req.param('slug'));
  const client = requireDb();
  const analysis = await analyze(slug);
  const missing = await publishAnalysis(client, slug, analysis, LANG);
  return c.json(report(analysis, true, missing));
});

api.post('/stories/:slug/cover', async (c) => {
  const body = await c.req.parseBody();
  const file = body.file;
  if (!(file instanceof File)) throw new HttpError(400, 'Aucune image reçue.');
  return c.json({ url: await uploadCover(c.req.param('slug'), file) });
});

/** Saves translations to content/translations/<lang>.json and, when configured, to Supabase. */
api.post('/translations', async (c) => {
  const { entries } = await c.req.json<{ entries: TranslationInput[] }>();
  const clean = (entries ?? [])
    .map((e) => ({
      word: e.word,
      pos: e.pos,
      translation: e.translation?.trim() ?? '',
      ...(e.example?.trim() ? { example: e.example.trim() } : {}),
    }))
    .filter((e) => e.word && e.pos && e.translation);
  if (!clean.length) throw new HttpError(400, 'Aucune traduction à enregistrer.');
  saveTranslations(LANG, clean);
  const client = db();
  if (client) await upsertTranslations(client, LANG, clean);
  return c.json({ saved: clean.length, online: !!client });
});

async function analyze(slug: string): Promise<StoryAnalysis> {
  try {
    return await analyzeStory(readStoryFile(slug), `${slug}.md`);
  } catch (e) {
    if (e instanceof HttpError) throw e;
    // Format errors ("file.md:12: …") are the author's to fix, not a server failure.
    throw new HttpError(422, e instanceof Error ? e.message : String(e));
  }
}

function report(
  { story, words, lemmas, chapterWords, tokensByPage }: StoryAnalysis,
  published: boolean,
  missing: Lemma[],
): AnalysisReport {
  // First paragraph using each lemma: the example offered for its translation.
  const context = new Map<string, string>();
  for (const tokens of tokensByPage.values()) {
    let line: typeof tokens = [];
    const flush = () => {
      const text = line
        .map((t) => t.text + t.whitespace)
        .join('')
        .trim();
      for (const t of line)
        if (t.lemma && !context.has(lemmaKeyId(t.lemma))) context.set(lemmaKeyId(t.lemma), text);
      line = [];
    };
    for (const t of tokens) {
      line.push(t);
      if (t.whitespace.includes('\n')) flush();
    }
    flush();
  }

  return {
    published,
    words,
    pages: story.chapters.reduce((n, ch) => n + ch.pages.length, 0),
    lemmas: lemmas.length,
    chapters: story.chapters.map((ch, i) => ({
      title: ch.title,
      pages: ch.pages.length,
      words: chapterWords[i]!,
    })),
    warnings: story.warnings,
    missing: missing.map(({ word, pos }) => ({
      word,
      pos,
      context: context.get(lemmaKeyId({ word, pos })) ?? '',
    })),
  };
}
