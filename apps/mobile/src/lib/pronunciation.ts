import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import { useEffect, useState } from 'react';

import { ensureAudioMode } from './audioMode';
import { supabase, unwrap } from './supabase';

/** Key of a text in the `pronunciations` table: lowercase, straight apostrophes. */
export const pronunciationKey = (text: string) => text.trim().toLowerCase().replace(/[‘’]/g, "'");

/** Clip URL by key; null: the text has no clip. Kept for the whole session. */
const cache = new Map<string, string | null>();
const inFlight = new Map<string, Promise<void>>();

/** Loads the clips of `texts` not in the cache yet (one request per 100 texts). */
export async function loadPronunciations(texts: string[]): Promise<void> {
  const keys = [...new Set(texts.map(pronunciationKey))];
  const waiting = keys.flatMap((k) => (inFlight.has(k) ? [inFlight.get(k)!] : []));
  const todo = keys.filter((k) => !cache.has(k) && !inFlight.has(k));
  for (let i = 0; i < todo.length; i += 100) {
    const batch = todo.slice(i, i + 100);
    const request = (async () => {
      try {
        const rows = unwrap(
          await supabase.from('pronunciations').select('text, audio_url').in('text', batch),
        ) as { text: string; audio_url: string }[];
        const found = new Map(rows.map((r) => [r.text, r.audio_url]));
        for (const k of batch) cache.set(k, found.get(k) ?? null);
      } finally {
        batch.forEach((k) => inFlight.delete(k));
      }
    })();
    batch.forEach((k) => inFlight.set(k, request));
    waiting.push(request);
  }
  await Promise.all(waiting);
}

/** First of `texts` that has a clip: undefined while loading, null if none has one. */
function firstUrl(keys: string[]): string | null | undefined {
  for (const k of keys) {
    const url = cache.get(k);
    if (url === undefined) return undefined;
    if (url) return url;
  }
  return null;
}

/** Clip of the first of `texts` that has one, once `loadPronunciations` has loaded them. */
export const cachedPronunciation = (texts: string[]) => firstUrl(texts.map(pronunciationKey));

/**
 * Clip for the first of `texts` that has one ("took", else its lemma "take"):
 * undefined while loading, null when none of them has a clip.
 */
export function usePronunciation(texts: string[]): string | null | undefined {
  const keys = texts.map(pronunciationKey);
  const id = keys.join('\n');
  // Re-renders once the cache has the keys.
  const [, setLoads] = useState(0);

  useEffect(() => {
    let live = true;
    loadPronunciations(id.split('\n'))
      .catch((e: unknown) => console.warn('pronunciations', e))
      .finally(() => live && setLoads((n) => n + 1));
    return () => {
      live = false;
    };
  }, [id]);

  return firstUrl(keys);
}

// One player for every pronunciation: a new word cuts the previous one.
let player: AudioPlayer | null = null;

export function playPronunciation(url: string) {
  ensureAudioMode();
  if (!player) {
    player = createAudioPlayer(url);
  } else {
    player.replace(url);
  }
  void player.seekTo(0);
  player.play();
}
