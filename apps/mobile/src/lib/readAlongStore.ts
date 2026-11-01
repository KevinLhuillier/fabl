import { useSyncExternalStore } from 'react';

/** Voice-over progress: tokens up to `readUpTo` are read, `current` is being spoken. */
export type ReadAlong = { readUpTo: number; current: number | null };

/**
 * Where the voice-over has got to, outside of React state. A change of word must not
 * re-render the reader screen and the whole text (hundreds of words): each word subscribes
 * to its own state ({@link useWordReadState}), so only the word that lights up and the one
 * that goes out re-render. That is what lets a low-end phone keep up with the voice.
 */
export function createReadAlongStore() {
  let state: ReadAlong | null = null;
  const listeners = new Set<() => void>();
  return {
    get: () => state,
    set(next: ReadAlong | null) {
      if (state?.readUpTo === next?.readUpTo && state?.current === next?.current) return;
      state = next;
      for (const listener of listeners) listener();
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export type ReadAlongStore = ReturnType<typeof createReadAlongStore>;

/** A store that never moves, for texts without voice-over. */
export const noReadAlong: ReadAlongStore = createReadAlongStore();

export const WORD_READ = 1;
export const WORD_CURRENT = 2;

/** State of one word: a bit mask of {@link WORD_READ} and {@link WORD_CURRENT}. */
export function useWordReadState(store: ReadAlongStore, position: number): number {
  return useSyncExternalStore(store.subscribe, () => {
    const s = store.get();
    if (!s) return 0;
    return (position <= s.readUpTo ? WORD_READ : 0) | (s.current === position ? WORD_CURRENT : 0);
  });
}
