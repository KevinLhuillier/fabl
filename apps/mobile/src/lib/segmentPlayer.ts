import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useCallback, useEffect, useRef } from 'react';

import { ensureAudioMode } from './audioMode';

/** Margins around the timings: Whisper's word boundaries are a little tight. */
const LEAD_MS = 120;
const TAIL_MS = 200;

/**
 * Plays an excerpt of a page's voice-over (a sentence of the story):
 * seeks to its start and pauses at its end.
 */
export function useSegmentPlayer(uri: string) {
  const player = useAudioPlayer(uri, { updateInterval: 50 });
  const status = useAudioPlayerStatus(player);
  const endMs = useRef<number | null>(null);

  useEffect(ensureAudioMode, []);

  useEffect(() => {
    if (endMs.current !== null && status.playing && status.currentTime * 1000 >= endMs.current) {
      endMs.current = null;
      player.pause();
    }
  }, [player, status.playing, status.currentTime]);

  const play = useCallback(
    (startMs: number, end: number) => {
      endMs.current = end + TAIL_MS;
      void player.seekTo(Math.max(0, startMs - LEAD_MS) / 1000).then(() => player.play());
    },
    [player],
  );

  const pause = useCallback(() => {
    endMs.current = null;
    player.pause();
  }, [player]);

  return { ready: status.isLoaded, playing: status.playing, play, pause };
}
