/**
 * Parser for Markdown stories.
 *
 *   ---
 *   title: Where Is Leo?
 *   level: A1
 *   summary: Mia's cat is not at home.
 *   ---
 *
 *   # Leo Is Not Here
 *
 *   It is Saturday morning.
 *   Mia has a cat.
 *
 *   ---
 *
 *   Mia goes into the garden.
 *
 * - The front matter (between the first two `---` lines) holds the metadata.
 * - `# Title` starts a chapter. Its key is `chapter_<n>` (position based), or
 *   an explicit id: `# Title {#my-id}` — use one to reorder chapters without
 *   mixing up the readers' progress.
 * - `---` separates two pages of a chapter.
 * - Each non-empty line is a paragraph. `<!-- comments -->` are ignored.
 */

export const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;
export type CefrLevel = (typeof CEFR_LEVELS)[number];

export type StoryMeta = { title: string; level: CefrLevel; summary: string };

export type Page = {
  /** "<chapter key>.page_<n>": stable key of the page. */
  key: string;
  /** Index of the page inside its chapter. */
  index: number;
  /** Paragraphs, in order. */
  lines: string[];
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
  };

  // --- Body: chapters and pages ------------------------------------------
  const chapters: Chapter[] = [];
  const warnings: string[] = [];
  let page: string[] = [];

  const closePage = (lineNo: number) => {
    const chapter = chapters[chapters.length - 1];
    if (!chapter) return;
    if (!page.length) {
      warnings.push(`${fileName}:${lineNo}: empty page in chapter "${chapter.title}" ignored.`);
    } else {
      const index = chapter.pages.length;
      chapter.pages.push({ key: `${chapter.key}.page_${index + 1}`, index, lines: page });
    }
    page = [];
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
    page.push(line);
  }
  closePage(lines.length);

  if (!chapters.length) fail('no chapter found (start one with "# Chapter title")');
  for (const c of chapters) {
    if (!c.pages.length) fail(`chapter "${c.title}" has no page`);
  }
  return { meta, chapters, warnings };
}
