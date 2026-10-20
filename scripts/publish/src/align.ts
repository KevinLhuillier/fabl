/**
 * Aligns the voice-over of a story's pages with their words, for the reader's
 * read-along highlighting. Writes content/alignments/<slug>.json; publish the
 * story afterwards to send the timings to the app.
 *
 *   npm run align-audio -- content/stories/c1-xxx.md [--page chapter_1.page_1] [--force] [--model small.en]
 *
 * Without --page, every page with an `@audio` line is aligned, except those whose
 * alignment is still current (same audio, same words) unless --force is given.
 * The first run downloads the Whisper model (~500 MB for small.en).
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';

import {
  isAlignmentCurrent,
  loadAlignments,
  savePageAlignment,
  spokenTokens,
} from './alignments.js';
import { resolveUserPath } from './env.js';
import { lemmatizePassages } from './lemmatize.js';
import { runPythonScript } from './python.js';
import { parseStory } from './story.js';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    page: { type: 'string', multiple: true },
    force: { type: 'boolean', default: false },
    model: { type: 'string', default: 'small.en' },
  },
});

type AlignResult = { timings: ([number, number] | null)[]; matched: number };

async function main() {
  const [arg] = positionals;
  if (!arg) {
    console.error(
      'Usage: npm run align-audio -- <file.md> [--page <key>] [--force] [--model small.en]',
    );
    process.exitCode = 1;
    return;
  }
  const file = resolveUserPath(arg);
  const slug = path.basename(file, path.extname(file));
  const story = parseStory(readFileSync(file, 'utf8'), path.basename(file));
  const allPages = story.chapters.flatMap((c) => c.pages);

  const unknown = (values.page ?? []).filter((k) => !allPages.some((p) => p.key === k));
  if (unknown.length) throw new Error(`Unknown page(s): ${unknown.join(', ')}`);
  const pages = allPages.filter((p) => p.audio && (!values.page || values.page.includes(p.key)));
  if (!pages.length) {
    console.log('No page with an @audio line to align.');
    return;
  }

  const tokenLists = await lemmatizePassages(pages.map((p) => p.lines));
  const stored = loadAlignments(slug).pages;
  console.log(`\n🎙️  ${slug}`);

  for (const [i, page] of pages.entries()) {
    const tokens = tokenLists[i]!;
    if (!values.force && isAlignmentCurrent(stored[page.key], page.audio!, tokens)) {
      console.log(`   ${page.key}: already aligned (--force to redo)`);
      continue;
    }
    const words = spokenTokens(tokens).map((t) => t.text);
    const { timings, matched } = await runPythonScript<AlignResult>('align.py', {
      audio: page.audio,
      words,
      model: values.model,
    });
    savePageAlignment(slug, page.key, {
      audio: page.audio!,
      words: words.map((w, k) => [w, timings[k]?.[0] ?? null, timings[k]?.[1] ?? null]),
    });
    const missing = timings.filter((t) => !t).length;
    const pct = Math.round(matched * 100);
    console.log(
      `   ${page.key}: ${words.length} words, ${pct}% matched${missing ? `, ${missing} without timing` : ''}` +
        (pct < 90 ? '  ⚠️  low match: does the recording follow the text?' : ''),
    );
  }
  console.log(
    `\n   Saved to content/alignments/${slug}.json — publish the story to update the app.`,
  );
}

main().catch((e: unknown) => {
  console.error(`\n❌ ${e instanceof Error ? e.message : String(e)}`);
  process.exitCode = 1;
});
