/**
 * Story files (content/stories/<slug>.md, the source of truth) and their
 * published copy in Supabase.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';

import { adminClient } from '../../../scripts/publish/src/db.js';
import { REPO_ROOT } from '../../../scripts/publish/src/env.js';
import { parseStory, serializeStory, type CefrLevel } from '../../../scripts/publish/src/story.js';
import type { PublishedInfo, StoryDetail, StoryListItem, StoryStatus } from '../shared/api.js';

export const STORIES_DIR = path.join(REPO_ROOT, 'content/stories');

/** Slug = file name: lowercase words separated by dashes ("a1-where-is-leo"). */
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export class HttpError extends Error {
  constructor(
    readonly status: 400 | 404 | 409 | 422 | 500 | 503,
    message: string,
  ) {
    super(message);
  }
}

export function checkSlug(slug: string) {
  if (!SLUG.test(slug)) {
    throw new HttpError(400, `Identifiant invalide « ${slug} » : minuscules, chiffres et tirets.`);
  }
  return slug;
}

export const storyPath = (slug: string) => path.join(STORIES_DIR, `${checkSlug(slug)}.md`);

/** Supabase client, or null when the .env has no keys (files can still be edited). */
export function db(): SupabaseClient | null {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  cached ??= adminClient();
  return cached;
}
let cached: SupabaseClient | undefined;

export function requireDb(): SupabaseClient {
  const client = db();
  if (!client) {
    throw new HttpError(
      503,
      'Supabase n’est pas configuré : renseigne SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY dans le .env à la racine.',
    );
  }
  return client;
}

type PublishedRow = {
  slug: string;
  title: string;
  level: CefrLevel;
  summary: string;
  cover_url: string | null;
  chapter_count: number;
  passage_count: number;
  word_count: number;
  updated_at: string;
};

async function publishedRows(slug?: string): Promise<Map<string, PublishedRow>> {
  const client = db();
  if (!client) return new Map();
  let query = client
    .from('stories')
    .select(
      'slug, title, level, summary, cover_url, chapter_count, passage_count, word_count, updated_at',
    );
  if (slug) query = query.eq('slug', slug);
  const { data, error } = await query;
  if (error) throw new HttpError(500, `Lecture Supabase : ${error.message}`);
  return new Map((data as PublishedRow[]).map((r) => [r.slug, r]));
}

const toPublished = (r: PublishedRow): PublishedInfo => ({
  title: r.title,
  level: r.level,
  coverUrl: r.cover_url,
  chapters: r.chapter_count,
  pages: r.passage_count,
  words: r.word_count,
  at: r.updated_at,
});

function statusOf(fileMtime: Date | null, row: PublishedRow | undefined): StoryStatus {
  if (!fileMtime) return 'online-only';
  if (!row) return 'draft';
  // A save after the publish (1 s of slack for clock differences).
  return fileMtime.getTime() > new Date(row.updated_at).getTime() + 1000 ? 'modified' : 'published';
}

function storyFiles() {
  if (!existsSync(STORIES_DIR)) return [];
  return readdirSync(STORIES_DIR)
    .filter((f) => f.endsWith('.md'))
    .map((f) => path.basename(f, '.md'));
}

export async function listStories(): Promise<StoryListItem[]> {
  const rows = await publishedRows();
  const items: StoryListItem[] = storyFiles().map((slug) => {
    const file = storyPath(slug);
    const mtime = statSync(file).mtime;
    const row = rows.get(slug);
    const base = {
      slug,
      status: statusOf(mtime, row),
      fileUpdatedAt: mtime.toISOString(),
      published: row ? toPublished(row) : null,
    };
    try {
      const { meta, chapters } = parseStory(readFileSync(file, 'utf8'), `${slug}.md`);
      return {
        ...base,
        title: meta.title,
        level: meta.level,
        summary: meta.summary,
        cover: meta.cover,
        chapters: chapters.length,
        pages: chapters.reduce((n, c) => n + c.pages.length, 0),
        error: null,
      };
    } catch (e) {
      return {
        ...base,
        title: row?.title ?? slug,
        level: row?.level ?? 'A1',
        summary: row?.summary ?? '',
        cover: row?.cover_url ?? null,
        chapters: 0,
        pages: 0,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  });

  const withFile = new Set(items.map((s) => s.slug));
  for (const row of rows.values()) {
    if (withFile.has(row.slug)) continue;
    items.push({
      slug: row.slug,
      title: row.title,
      level: row.level,
      summary: row.summary,
      cover: row.cover_url,
      status: 'online-only',
      chapters: row.chapter_count,
      pages: row.passage_count,
      error: null,
      fileUpdatedAt: null,
      published: toPublished(row),
    });
  }
  return items;
}

export async function getStory(slug: string): Promise<StoryDetail> {
  const file = storyPath(slug);
  const row = (await publishedRows(slug)).get(slug);
  const exists = existsSync(file);
  if (!exists && !row) throw new HttpError(404, `Histoire « ${slug} » introuvable.`);
  const mtime = exists ? statSync(file).mtime : null;
  return {
    slug,
    source: exists ? readFileSync(file, 'utf8').replace(/\r\n?/g, '\n') : null,
    status: statusOf(mtime, row),
    fileUpdatedAt: mtime?.toISOString() ?? null,
    published: row ? toPublished(row) : null,
  };
}

export function readStoryFile(slug: string): string {
  const file = storyPath(slug);
  if (!existsSync(file)) throw new HttpError(404, `Pas de fichier pour « ${slug} ».`);
  return readFileSync(file, 'utf8');
}

/** Writes the file (LF line endings, like the existing stories). */
export function writeStoryFile(slug: string, source: string) {
  mkdirSync(STORIES_DIR, { recursive: true });
  writeFileSync(storyPath(slug), source.replace(/\r\n?/g, '\n'), 'utf8');
}

export function createStoryFile(slug: string, title: string, level: CefrLevel) {
  if (existsSync(storyPath(slug))) {
    throw new HttpError(409, `Une histoire « ${slug} » existe déjà.`);
  }
  writeStoryFile(
    slug,
    serializeStory({ title, level, summary: '', cover: null }, [
      { key: null, title: 'Chapter One', pages: [['Once upon a time…']] },
    ]),
  );
}

export function deleteStoryFile(slug: string) {
  const file = storyPath(slug);
  if (existsSync(file)) unlinkSync(file);
}

/** Removes the story from the app: chapters, pages, tokens and readers' progress cascade. */
export async function unpublishStory(slug: string) {
  const { error } = await requireDb().from('stories').delete().eq('slug', checkSlug(slug));
  if (error) throw new HttpError(500, `Suppression Supabase : ${error.message}`);
}

/** Rebuilds the story file from its published copy (for stories published without a file). */
export async function importStoryFile(slug: string) {
  if (existsSync(storyPath(slug))) {
    throw new HttpError(409, `Le fichier de « ${slug} » existe déjà.`);
  }
  const { data, error } = await requireDb()
    .from('stories')
    .select(
      'title, level, summary, cover_url, chapters(key, position, title, passages(page_index, text))',
    )
    .eq('slug', slug)
    .single();
  if (error) throw new HttpError(404, `Histoire « ${slug} » introuvable en ligne.`);

  const row = data as {
    title: string;
    level: CefrLevel;
    summary: string;
    cover_url: string | null;
    chapters: {
      key: string;
      position: number;
      title: string;
      passages: { page_index: number; text: string }[];
    }[];
  };
  const chapters = [...row.chapters]
    .sort((a, b) => a.position - b.position)
    .map((c) => ({
      key: c.key,
      title: c.title,
      pages: [...c.passages]
        .sort((a, b) => a.page_index - b.page_index)
        .map((p) => p.text.split('\n')),
    }));
  writeStoryFile(
    slug,
    serializeStory(
      { title: row.title, level: row.level, summary: row.summary, cover: row.cover_url },
      chapters,
    ),
  );
}

const COVER_BUCKET = 'covers';
const COVER_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/** Uploads a cover to the public "covers" bucket and returns its public URL. */
export async function uploadCover(slug: string, file: File): Promise<string> {
  const ext = COVER_TYPES[file.type];
  if (!ext) throw new HttpError(400, 'Formats acceptés : JPEG, PNG ou WebP.');
  if (file.size > 5 * 1024 * 1024) throw new HttpError(400, 'Image trop lourde (5 Mo maximum).');

  const storage = requireDb().storage.from(COVER_BUCKET);
  const objectPath = `${checkSlug(slug)}/${Date.now()}.${ext}`;
  const { error } = await storage.upload(objectPath, await file.arrayBuffer(), {
    contentType: file.type,
    upsert: false,
  });
  if (error) {
    throw new HttpError(
      500,
      `Envoi de l’image : ${error.message}. La migration du bucket « covers » est-elle appliquée ?`,
    );
  }
  return storage.getPublicUrl(objectPath).data.publicUrl;
}
