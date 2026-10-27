import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { requireEnv } from './env.js';
import type { ParsedStory } from './story.js';
import { lemmaKeyId, type LemmaKey, type Token } from './lemmatize.js';
import type { TranslationEntry } from './translations.js';

const CHUNK = 500;

function chunks<T>(items: T[], size = CHUNK): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function check<T>(res: { data: T | null; error: { message: string } | null }, what: string): T {
  if (res.error) throw new Error(`${what}: ${res.error.message}`);
  return res.data as T;
}

/** Service-role client: bypasses RLS. Only ever used by this script. */
export function adminClient(): SupabaseClient {
  return createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Upserts lemmas on (word, pos) and returns a "word|pos" → id map. */
export async function upsertLemmas(db: SupabaseClient, lemmas: LemmaKey[]) {
  // Only (word, pos): callers may pass richer objects (e.g. translation entries).
  const unique = [
    ...new Map(lemmas.map(({ word, pos }) => [lemmaKeyId({ word, pos }), { word, pos }])).values(),
  ];
  const ids = new Map<string, number>();
  for (const batch of chunks(unique)) {
    const rows = check(
      await db.from('lemmas').upsert(batch, { onConflict: 'word,pos' }).select('id, word, pos'),
      'Upsert lemmas',
    ) as { id: number; word: string; pos: string }[];
    rows.forEach((r) => ids.set(lemmaKeyId(r), r.id));
  }
  return ids;
}

/** Words of a page: tokens carrying a lemma (punctuation and numbers excluded). */
export const wordCount = (tokens: Token[]) => tokens.filter((t) => t.lemma).length;

/**
 * Idempotent publish, keyed by slug: story, chapters and pages (by their
 * `key`) are upserted, the ones removed from the story file are deleted, and
 * each page's tokens are replaced. Re-running after a partial failure
 * converges to the same state.
 */
export async function publishStory(
  db: SupabaseClient,
  slug: string,
  story: ParsedStory,
  tokensByPage: Map<string, Token[]>,
) {
  const pages = story.chapters.flatMap((c) => c.pages.map((p) => ({ ...p, chapter: c })));
  const words = (keys: string[]) => keys.reduce((n, k) => n + wordCount(tokensByPage.get(k)!), 0);

  const { id: storyId } = check(
    await db
      .from('stories')
      .upsert(
        {
          slug,
          title: story.meta.title,
          level: story.meta.level,
          summary: story.meta.summary,
          cover_url: story.meta.cover,
          premium: story.meta.premium,
          passage_count: pages.length,
          chapter_count: story.chapters.length,
          word_count: words(pages.map((p) => p.key)),
        },
        { onConflict: 'slug' },
      )
      .select('id')
      .single(),
    'Upsert story',
  ) as { id: string };

  // Chapters: delete the removed ones (pages, tokens and progress cascade), upsert the rest.
  const oldChapters = check(
    await db.from('chapters').select('id, key').eq('story_id', storyId),
    'Read chapters',
  ) as { id: string; key: string }[];
  const chapterKeys = new Set(story.chapters.map((c) => c.key));
  const staleChapters = oldChapters.filter((c) => !chapterKeys.has(c.key)).map((c) => c.id);
  if (staleChapters.length) {
    check(await db.from('chapters').delete().in('id', staleChapters), 'Delete chapters');
  }
  const chapterRows = check(
    await db
      .from('chapters')
      .upsert(
        story.chapters.map((c) => ({
          story_id: storyId,
          key: c.key,
          position: c.position,
          title: c.title,
          page_count: c.pages.length,
          word_count: words(c.pages.map((p) => p.key)),
        })),
        { onConflict: 'story_id,key' },
      )
      .select('id, key'),
    'Upsert chapters',
  ) as { id: string; key: string }[];
  const chapterIds = new Map(chapterRows.map((c) => [c.key, c.id]));

  // Pages (passages), keyed by "<chapter key>.page_<n>".
  const oldPages = check(
    await db.from('passages').select('id, key').eq('story_id', storyId),
    'Read passages',
  ) as { id: string; key: string }[];
  const pageKeys = new Set(pages.map((p) => p.key));
  const stalePages = oldPages.filter((p) => !pageKeys.has(p.key)).map((p) => p.id);
  for (const batch of chunks(stalePages, 100)) {
    check(await db.from('passages').delete().in('id', batch), 'Delete passages');
  }
  const pageRows = check(
    await db
      .from('passages')
      .upsert(
        pages.map((p, position) => ({
          story_id: storyId,
          chapter_id: chapterIds.get(p.chapter.key)!,
          key: p.key,
          position,
          page_index: p.index,
          text: p.lines.join('\n'),
          audio_url: p.audio,
        })),
        { onConflict: 'story_id,key' },
      )
      .select('id, key'),
    'Upsert passages',
  ) as { id: string; key: string }[];
  const pageIds = new Map(pageRows.map((p) => [p.key, p.id]));

  const allTokens = [...tokensByPage.values()].flat();
  const lemmaIds = await upsertLemmas(
    db,
    allTokens.flatMap((t) => [
      ...(t.lemma ? [t.lemma] : []),
      ...(t.phrase ? [t.phrase.lemma] : []),
    ]),
  );

  // Replace tokens wholesale: simpler and safer than diffing positions.
  for (const batch of chunks([...pageIds.values()], 100)) {
    check(await db.from('tokens').delete().in('passage_id', batch), 'Delete tokens');
  }
  const tokenRows = [...tokensByPage].flatMap(([key, tokens]) =>
    tokens.map((t) => ({
      passage_id: pageIds.get(key)!,
      position: t.position,
      text: t.text,
      whitespace: t.whitespace,
      lemma_id: t.lemma ? lemmaIds.get(lemmaKeyId(t.lemma))! : null,
      phrase_lemma_id: t.phrase ? lemmaIds.get(lemmaKeyId(t.phrase.lemma))! : null,
      phrase_start: t.phrase?.start ?? null,
      start_ms: t.startMs ?? null,
      end_ms: t.endMs ?? null,
    })),
  );
  for (const batch of chunks(tokenRows)) {
    check(await db.from('tokens').insert(batch), 'Insert tokens');
  }

  return { storyId, lemmaIds, tokenCount: tokenRows.length };
}

/** Returns the lemma ids (among `ids`) that have no translation in `lang`. */
export async function lemmasWithoutTranslation(db: SupabaseClient, ids: number[], lang: string) {
  const translated = new Set<number>();
  for (const batch of chunks(ids)) {
    const rows = check(
      await db.from('translations').select('lemma_id').eq('lang', lang).in('lemma_id', batch),
      'Read translations',
    ) as { lemma_id: number }[];
    rows.forEach((r) => translated.add(r.lemma_id));
  }
  return ids.filter((id) => !translated.has(id));
}

export async function upsertTranslations(
  db: SupabaseClient,
  lang: string,
  entries: TranslationEntry[],
) {
  const lemmaIds = await upsertLemmas(db, entries);
  const rows = entries.map((e) => ({
    lemma_id: lemmaIds.get(lemmaKeyId(e))!,
    lang,
    translation: e.translation,
    example: e.example ?? null,
  }));
  for (const batch of chunks(rows)) {
    check(
      await db.from('translations').upsert(batch, { onConflict: 'lemma_id,lang' }),
      'Upsert translations',
    );
  }
  return rows.length;
}
