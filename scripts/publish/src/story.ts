/**
 * Parser for Markdown stories.
 *
 *   ---
 *   title: Where Is Leo?
 *   level: A1
 *   summary: Mia's cat is not at home.
 *   cover: https://example.com/leo.jpg   (optional, front cover image)
 *   premium: true                        (optional: only the first chapter is free)
 *   ---
 *
 *   # Leo Is Not Here
 *
 *   It is Saturday morning.
 *   Mia has a cat.
 *
 *   ---
 *
 *   @audio https://example.com/leo-1-2.mp3   (optional, voice-over of the page)
 *   Mia goes into the garden.
 *
 * - The front matter (between the first two `---` lines) holds the metadata.
 * - `# Title` starts a chapter. Its key is `chapter_<n>` (position based), or
 *   an explicit id: `# Title {#my-id}` — use one to reorder chapters without
 *   mixing up the readers' progress.
 * - `---` separates two pages of a chapter.
 * - Each non-empty line is a paragraph. `<!-- comments -->` are ignored.
 * - `@audio <url>` (one per page, anywhere in it) attaches a recorded
 *   voice-over (MP3) to the page. It is not part of the text.
 */

export const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;
export type CefrLevel = (typeof CEFR_LEVELS)[number];

export type StoryMeta = {
  title: string;
  level: CefrLevel;
  summary: string;
  /** Front cover image URL; null lets the app draw a default cover. */
  cover: string | null;
  /** Premium story: free accounts read the first chapter only. */
  premium: boolean;
};

export type Page = {
  /** "<chapter key>.page_<n>": stable key of the page. */
  key: string;
  /** Index of the page inside its chapter. */
  index: number;
  /** Paragraphs, in order. */
  lines: string[];
  /** Voice-over of the page (MP3 URL), or null. */
  audio: string | null;
  /** Source line (1-based) of the page's first paragraph. */
  line: number;
};

export type Chapter = {
  key: string;
  position: number;
  title: string;
  pages: Page[];
};

export type ParsedStory = {
  meta: StoryMeta;
  chapters: Chapter[];
  /** Convention violations that don't block publishing. */
  warnings: string[];
};

const SEPARATOR = /^-{3,}\s*$/;
const HEADING = /^#\s+(.+?)\s*(?:\{#([\w-]+)\})?\s*$/;
const AUDIO = /^@audio\b\s*(.*)$/;

export function parseStory(source: string, fileName: string): ParsedStory {
  const fail = (message: string, line?: number): never => {
    throw new Error(`${fileName}${line ? `:${line}` : ''}: ${message}`);
  };

  const text = source
    .replace(/\r\n?/g, '\n')
    // Keep the newlines of removed comments so error line numbers stay right.
    .replace(/<!--[\s\S]*?-->/g, (comment) => comment.replace(/[^\n]/g, ''));
  const lines = text.split('\n');

  // --- Front matter -------------------------------------------------------
  let i = 0;
  while (i < lines.length && !lines[i]!.trim()) i++;
  if (!SEPARATOR.test(lines[i] ?? ''))
    fail('missing front matter (--- title / level / summary ---)');
  const fields = new Map<string, string>();
  for (i++; i < lines.length && !SEPARATOR.test(lines[i]!); i++) {
    const line = lines[i]!.trim();
    if (!line) continue;
    const colon = line.indexOf(':');
    if (colon <= 0) fail(`invalid front matter line "${line}" (expected "key: value")`, i + 1);
    fields.set(line.slice(0, colon).trim().toLowerCase(), line.slice(colon + 1).trim());
  }
  if (i >= lines.length) fail('front matter is not closed by a "---" line');
  i++;

  const title = fields.get('title');
  const level = fields.get('level')?.toUpperCase();
  if (!title) fail('front matter needs "title: ..."');
  if (!level || !(CEFR_LEVELS as readonly string[]).includes(level)) {
    fail(`front matter "level" must be one of ${CEFR_LEVELS.join(', ')}`);
  }
  const meta: StoryMeta = {
    title: title!,
    level: level as CefrLevel,
    summary: fields.get('summary') ?? '',
    cover: fields.get('cover') || null,
    premium: false,
  };
  const premium = fields.get('premium')?.toLowerCase();
  if (premium !== undefined && premium !== 'true' && premium !== 'false') {
    fail('front matter "premium" must be true or false');
  }
  meta.premium = premium === 'true';
  if (meta.cover && !/^https?:\/\//.test(meta.cover)) {
    fail('front matter "cover" must be an http(s) image URL');
  }

  // --- Body: chapters and pages ------------------------------------------
  const chapters: Chapter[] = [];
  const warnings: string[] = [];
  let page: string[] = [];
  let audio: string | null = null;
  let pageLine = 0;

  const closePage = (lineNo: number) => {
    const chapter = chapters[chapters.length - 1];
    if (!chapter) return;
    if (!page.length && audio) {
      fail(`page with an "@audio" but no text in chapter "${chapter.title}"`, lineNo);
    } else if (!page.length) {
      warnings.push(`${fileName}:${lineNo}: empty page in chapter "${chapter.title}" ignored.`);
    } else {
      const index = chapter.pages.length;
      chapter.pages.push({
        key: `${chapter.key}.page_${index + 1}`,
        index,
        lines: page,
        audio,
        line: pageLine,
      });
    }
    page = [];
    audio = null;
  };

  for (; i < lines.length; i++) {
    const raw = lines[i]!;
    const line = raw.trim();
    if (!line) continue;

    const heading = HEADING.exec(line);
    if (heading) {
      if (chapters.length) closePage(i + 1);
      const position = chapters.length;
      const key = heading[2] ?? `chapter_${position + 1}`;
      if (chapters.some((c) => c.key === key)) fail(`duplicate chapter id "${key}"`, i + 1);
      chapters.push({ key, position, title: heading[1]!, pages: [] });
      continue;
    }
    if (line.startsWith('#')) fail('only "# Chapter title" headings are supported', i + 1);
    if (SEPARATOR.test(line)) {
      if (!chapters.length) fail('page separator before the first "# Chapter"', i + 1);
      closePage(i + 1);
      continue;
    }
    if (!chapters.length) fail(`text before the first "# Chapter": "${line}"`, i + 1);
    const audioLine = AUDIO.exec(line);
    if (audioLine) {
      if (!/^https?:\/\/\S+$/.test(audioLine[1]!)) fail('"@audio" needs an http(s) MP3 URL', i + 1);
      if (audio) fail('only one "@audio" per page', i + 1);
      audio = audioLine[1]!;
      continue;
    }
    if (!page.length) pageLine = i + 1;
    page.push(line);
  }
  closePage(lines.length);

  if (!chapters.length) fail('no chapter found (start one with "# Chapter title")');
  for (const c of chapters) {
    if (!c.pages.length) fail(`chapter "${c.title}" has no page`);
  }
  return { meta, chapters, warnings };
}

// --- Writing ------------------------------------------------------------------

export type DraftChapter = {
  /** Existing key (kept so readers' progress follows the chapter); null for a new chapter. */
  key: string | null;
  title: string;
  pages: DraftPage[];
};

export type DraftPage = {
  /** Paragraphs, in order. */
  lines: string[];
  /** Voice-over URL, or null. */
  audio: string | null;
};

/** Default key of the chapter at `position` (when the file gives no explicit id). */
export const defaultChapterKey = (position: number) => `chapter_${position + 1}`;

/**
 * Inverse of `parseStory` (comments aside): writes a story file. A chapter
 * whose key differs from its position's default key (it was moved, or a
 * chapter before it was removed) gets an explicit `{#key}` so progress stays
 * attached to it. New chapters take their default key when it is free.
 */
export function serializeStory(meta: StoryMeta, chapters: DraftChapter[]): string {
  const oneLine = (s: string) => s.replace(/\s+/g, ' ').trim();
  const taken = new Set(chapters.flatMap((c) => (c.key ? [c.key] : [])));
  const keys = chapters.map((c, position) => {
    if (c.key) return c.key;
    let key = defaultChapterKey(position);
    while (taken.has(key)) key = `chapter_${Math.random().toString(36).slice(2, 8)}`;
    taken.add(key);
    return key;
  });

  const front = [
    '---',
    `title: ${oneLine(meta.title)}`,
    `level: ${meta.level}`,
    `summary:${meta.summary.trim() ? ` ${oneLine(meta.summary)}` : ''}`,
    ...(meta.cover ? [`cover: ${meta.cover.trim()}`] : []),
    ...(meta.premium ? ['premium: true'] : []),
    '---',
  ].join('\n');

  const body = chapters.map((c, position) => {
    const key = keys[position]!;
    const id = key === defaultChapterKey(position) ? '' : ` {#${key}}`;
    // The voice-over goes first, so it reads as the page's heading in the file.
    const pages = c.pages.map(({ lines, audio }) =>
      [...(audio ? [`@audio ${audio.trim()}`] : []), ...lines.map((l) => l.trim())]
        .filter(Boolean)
        .join('\n'),
    );
    return `# ${oneLine(c.title)}${id}\n\n${pages.join('\n\n---\n\n')}`;
  });

  return `${front}\n\n${body.join('\n\n')}\n`;
}
