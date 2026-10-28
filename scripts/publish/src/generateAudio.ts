/**
 * Generates the voice-over of a story's pages with ElevenLabs text-to-speech,
 * uploads each MP3 to the public "audio" bucket and adds its `@audio` line to
 * the story file. Then run align-audio and publish the story.
 *
 *   npm run generate-audio -- content/stories/c1-xxx.md [--page chapter_2.page_1] [--dry-run]
 *
 * Only pages without an `@audio` line are generated (remove the line to redo a
 * page). The file is saved after each page, so an interrupted run loses nothing.
 * --dry-run lists the pages and their character count (what ElevenLabs bills).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';

import { adminClient } from './db.js';
import { requireEnv, resolveUserPath } from './env.js';
import { VOICE_SETTINGS } from './pronunciations.js';
import { pageParagraphs, parseStory, type Page } from './story.js';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    page: { type: 'string', multiple: true },
    'dry-run': { type: 'boolean', default: false },
  },
});

const AUDIO_BUCKET = 'audio';

const pageText = (page: Page) => pageParagraphs(page).join('\n');

async function main() {
  const [arg] = positionals;
  if (!arg) {
    console.error('Usage: npm run generate-audio -- <file.md> [--page <key>] [--dry-run]');
    process.exitCode = 1;
    return;
  }
  const file = resolveUserPath(arg);
  const slug = path.basename(file, path.extname(file));
  const allPages = parseStory(readFileSync(file, 'utf8'), path.basename(file)).chapters.flatMap(
    (c) => c.pages,
  );

  const unknown = (values.page ?? []).filter((k) => !allPages.some((p) => p.key === k));
  if (unknown.length) throw new Error(`Unknown page(s): ${unknown.join(', ')}`);
  const todo = allPages.filter((p) => !p.audio && (!values.page || values.page.includes(p.key)));
  if (!todo.length) {
    console.log('Every page already has an @audio line.');
    return;
  }

  const chars = todo.reduce((n, p) => n + pageText(p).length, 0);
  console.log(`\n🗣️  ${slug}: ${todo.length} page(s), ${chars} characters`);
  if (values['dry-run']) {
    for (const p of todo) console.log(`   ${p.key}: ${pageText(p).length} characters`);
    return;
  }

  const apiKey = requireEnv('ELEVENLABS_API_KEY');
  const voiceId = requireEnv('ELEVENLABS_VOICE_ID');
  const modelId = process.env.ELEVENLABS_MODEL || 'eleven_v4';
  const storage = adminClient().storage.from(AUDIO_BUCKET);

  for (const page of todo) {
    // The neighbouring pages keep the intonation continuous from one page to the next.
    const i = allPages.indexOf(page);
    const previous = allPages[i - 1];
    const next = allPages[i + 1];
    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
      {
        method: 'POST',
        headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: pageText(page),
          model_id: modelId,
          voice_settings: VOICE_SETTINGS,
          ...(previous ? { previous_text: pageParagraphs(previous).at(-1) } : {}),
          ...(next ? { next_text: pageParagraphs(next)[0] } : {}),
        }),
      },
    );
    if (!res.ok) throw new Error(`ElevenLabs (${page.key}): ${res.status} ${await res.text()}`);
    const mp3 = await res.arrayBuffer();

    const objectPath = `${slug}/${page.key}-${Date.now()}.mp3`;
    const { error } = await storage.upload(objectPath, mp3, {
      contentType: 'audio/mpeg',
      upsert: false,
    });
    if (error) throw new Error(`Upload (${page.key}): ${error.message}`);
    const url = storage.getPublicUrl(objectPath).data.publicUrl;

    // Re-read the file in case it changed, and put the line before the page's first paragraph.
    const source = readFileSync(file, 'utf8');
    const current = parseStory(source, path.basename(file))
      .chapters.flatMap((c) => c.pages)
      .find((p) => p.key === page.key);
    if (!current || current.audio) throw new Error(`${page.key} changed during the run.`);
    const eol = source.includes('\r\n') ? '\r\n' : '\n';
    const lines = source.split(/\r?\n/);
    lines.splice(current.line - 1, 0, `@audio ${url}`);
    writeFileSync(file, lines.join(eol), 'utf8');

    console.log(`   ${page.key}: ${(mp3.byteLength / 1024).toFixed(0)} KB`);
  }
  console.log(`\n   Next: npm run align-audio -- ${arg}, then npm run publish-story -- ${arg}`);
}

main().catch((e: unknown) => {
  console.error(`\n❌ ${e instanceof Error ? e.message : String(e)}`);
  process.exitCode = 1;
});
