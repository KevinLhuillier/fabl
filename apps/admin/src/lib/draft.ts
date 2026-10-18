/**
 * Visual editor model of a story file. Converts to/from Markdown with the
 * publish script's own parser and serializer, so both always agree.
 */
import { parseStory, serializeStory, type StoryMeta } from '@publish/story';

/** `audio`: voice-over URL (the page's "@audio" line), or null. */
export type DraftPage = { id: string; text: string; audio: string | null };
export type DraftChapter = { id: string; key: string | null; title: string; pages: DraftPage[] };
export type Draft = { meta: StoryMeta; chapters: DraftChapter[] };

let next = 0;
export const uid = () => `d${++next}`;

export const newPage = (text = '', audio: string | null = null): DraftPage => ({
  id: uid(),
  text,
  audio,
});
export const newChapter = (title = ''): DraftChapter => ({
  id: uid(),
  key: null,
  title,
  pages: [newPage()],
});

/** Throws the parser's error ("story.md:12: …") when the Markdown is invalid. */
export function fromSource(source: string): Draft {
  const { meta, chapters } = parseStory(source, 'story.md');
  return {
    meta,
    chapters: chapters.map((c) => ({
      id: uid(),
      key: c.key,
      title: c.title,
      pages: c.pages.map((p) => newPage(p.lines.join('\n'), p.audio)),
    })),
  };
}

export function toSource({ meta, chapters }: Draft): string {
  return serializeStory(
    meta,
    chapters.map((c) => ({
      key: c.key,
      title: c.title,
      pages: c.pages.map((p) => ({ lines: p.text.split('\n'), audio: p.audio })),
    })),
  );
}

/** Format error of a Markdown source, or null. Shown live while editing. */
export function sourceError(source: string): string | null {
  try {
    parseStory(source, 'story.md');
    return null;
  } catch (e) {
    return (e instanceof Error ? e.message : String(e))
      .replace(/^story\.md:(\d+):\s*/, 'Ligne $1 : ')
      .replace(/^story\.md:\s*/, '');
  }
}
