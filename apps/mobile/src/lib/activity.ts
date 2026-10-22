import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { IDLE_AFTER_MS } from './gamification';
import { useStats } from './stats';

const chapterTimeKey = (chapterId: string) => `fabl.chapterTime.${chapterId}`;

/**
 * Time read in a chapter over the sessions before it is finished (the reader
 * may be closed and reopened), kept on the device: `saveChapterTime` adds a
 * session, `takeChapterTime` returns the sum and forgets it.
 */
export async function saveChapterTime(chapterId: string, seconds: number) {
  if (seconds < 1) return;
  try {
    const before = Number(await AsyncStorage.getItem(chapterTimeKey(chapterId))) || 0;
    await AsyncStorage.setItem(chapterTimeKey(chapterId), String(before + seconds));
  } catch (e) {
    console.warn('saveChapterTime', e);
  }
}

export async function takeChapterTime(chapterId: string): Promise<number> {
  try {
    const seconds = Number(await AsyncStorage.getItem(chapterTimeKey(chapterId))) || 0;
    await AsyncStorage.removeItem(chapterTimeKey(chapterId));
    return seconds;
  } catch (e) {
    console.warn('takeChapterTime', e);
    return 0;
  }
}

/** Practice time is sent in chunks of this many seconds (and when the screen closes). */
const FLUSH_EVERY_S = 30;

/**
 * Counts the practice time spent on a screen (reader, review), towards the
 * daily goal. A second counts while the app is in the foreground and the user
 * interacted less than IDLE_AFTER_MS ago: call `touch()` on every interaction
 * (page turn, word tap, typing, voice-over playing…).
 *
 * `flush()` sends the pending time (await it before showing the goal, e.g. on
 * the celebration screen); `seconds()` is the time counted on this screen.
 */
export function useActivityTimer() {
  const { addActivity } = useStats();
  const lastTouch = useRef(0);
  const pending = useRef(0);
  const counted = useRef(0);

  const flush = useCallback(async () => {
    const seconds = pending.current;
    if (seconds < 1) return;
    pending.current = 0;
    await addActivity(seconds);
  }, [addActivity]);

  useEffect(() => {
    // Opening the screen is an interaction.
    lastTouch.current = Date.now();
    let active = AppState.currentState === 'active';
    const sub = AppState.addEventListener('change', (state) => {
      active = state === 'active';
      // Coming back to the app is an interaction; leaving it sends what was read.
      if (active) lastTouch.current = Date.now();
      else void flush();
    });
    const tick = setInterval(() => {
      if (!active || Date.now() - lastTouch.current > IDLE_AFTER_MS) return;
      pending.current++;
      counted.current++;
      if (pending.current >= FLUSH_EVERY_S) void flush();
    }, 1000);
    return () => {
      clearInterval(tick);
      sub.remove();
      void flush();
    };
  }, [flush]);

  const touch = useCallback(() => {
    lastTouch.current = Date.now();
  }, []);
  const seconds = useCallback(() => counted.current, []);

  return { touch, flush, seconds };
}
