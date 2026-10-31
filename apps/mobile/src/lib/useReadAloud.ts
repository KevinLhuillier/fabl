import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';

import { restorePlaybackMode } from './audioMode';
import {
  alignReading,
  pageWords,
  transcriptWords,
  type PageWord,
  type ReadAloudProgress,
} from './readAloud';
import type { Token } from './types';

type SpeechModule = typeof import('expo-speech-recognition');

/**
 * The native module is missing from builds made before it was added: the import
 * throws there, and reading aloud is simply not offered.
 */
const speech: SpeechModule | null = (() => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-speech-recognition') as SpeechModule;
  } catch {
    return null;
  }
})();

const recognizer = speech?.ExpoSpeechRecognitionModule ?? null;

function recognitionAvailable(): boolean {
  try {
    return !!recognizer?.isRecognitionAvailable();
  } catch {
    return false;
  }
}

/**
 * On-device recognition answers much faster than the network one (each word shows
 * sooner) and keeps the voice on the phone. Dropped for the session once it fails
 * (no English model on the phone): the network recognizer takes over.
 */
let onDevice = (() => {
  try {
    return !!recognizer?.supportsOnDeviceRecognition();
  } catch {
    return false;
  }
})();

/** Errors of an on-device session that mean "not possible here", not a real failure. */
const ON_DEVICE_UNSUPPORTED = new Set<string>([
  'language-not-supported',
  'service-not-allowed',
  'client',
  'unknown',
]);

const MODEL_ASKED_KEY = 'fabl.speechModelAsked';

/**
 * Android without the English on-device model: asks the system to download it, once
 * (Android 14+ downloads it in the background, Android 13 shows a dialog). The next
 * readings use it.
 */
async function askModelDownload() {
  if (Platform.OS !== 'android' || !recognizer) return;
  try {
    if (await AsyncStorage.getItem(MODEL_ASKED_KEY)) return;
    await AsyncStorage.setItem(MODEL_ASKED_KEY, '1');
    await recognizer.androidTriggerOfflineModelDownload({ locale: LANG });
  } catch (e) {
    console.warn('speech model download', e);
  }
}

const sameProgress = (a: ReadAloudProgress | null, b: ReadAloudProgress | null) =>
  a === b ||
  (!!a &&
    !!b &&
    a.readUpTo === b.readUpTo &&
    a.current === b.current &&
    a.done === b.done &&
    a.heard === b.heard &&
    a.wrong.size === b.wrong.size &&
    [...a.wrong].every((p) => b.wrong.has(p)));

/** Why reading aloud stopped by itself. */
export type ReadAloudError = 'permission' | 'unavailable' | 'network' | 'failed';

/** Language of the stories. */
const LANG = 'en-US';
/** Recognition sessions in a row without a word: the reader has stopped, so do we. */
const MAX_SILENT_SESSIONS = 3;

const join = (a: string, b: string) => (a && b ? `${a} ${b}` : a || b);

/**
 * Reading a page aloud: listens to the reader and follows the text (see readAloud.ts).
 * The recognizer stops after a silence or after a while (Android 12-, iOS): it is
 * restarted until the reader stops, and the text heard so far is kept, so pausing
 * and resuming carries on where the reader left. `reset` starts the page over.
 *
 * Pass a key that changes with the page (its id): a new page starts over.
 * `onHeard` fires on every recognized word (the reading time counts), `onError` when
 * listening stops on an error.
 */
export function useReadAloud(
  tokens: Token[],
  pageKey: string,
  { onHeard, onError }: { onHeard?: () => void; onError?: (error: ReadAloudError) => void } = {},
) {
  const [available] = useState(recognitionAvailable);
  const words = useMemo(() => pageWords(tokens), [tokens]);
  // Names of the page: the recognizer spells them better when it knows them.
  const names = useMemo(
    () => [...new Set(tokens.filter((t) => t.lemma?.pos === 'PROPN').map((t) => t.text))],
    [tokens],
  );

  const [listening, setListening] = useState(false);
  // Feedback on the page `page` (another page has heard nothing yet). Computed as the
  // results arrive and stored only when it changes: the screen re-renders only when a
  // word changes color, not on every partial result.
  const [shown, setShown] = useState<{ page: string; progress: ReadAloudProgress | null }>({
    page: pageKey,
    progress: null,
  });
  const progress = shown.page === pageKey ? shown.progress : null;
  const pageRef = useRef(pageKey);
  const wordsRef = useRef<PageWord[]>(words);
  // Index of the word the reading starts at (double tap on a word); 0: the page's start.
  const startRef = useRef(0);
  useEffect(() => {
    wordsRef.current = words;
  }, [words]);
  // The current session runs on-device; it fell back to the network recognizer.
  const sessionOnDevice = useRef(false);
  // The next `end` must start a new session at once (fallback or new start word).
  const fallingBack = useRef(false);
  // Whether the reader wants to be listened to (the recognizer may be between two sessions).
  const wanted = useRef(false);
  // A session of this page is running: its results count, even the final one after a stop.
  const accepting = useRef(false);
  // Final results of the sessions so far, and the current session's partial one.
  const committed = useRef('');
  const partial = useRef('');
  const silentSessions = useRef(0);
  const heardInSession = useRef(false);
  const onHeardRef = useRef(onHeard);
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onHeardRef.current = onHeard;
    onErrorRef.current = onError;
  }, [onHeard, onError]);
  const fail = useCallback((error: ReadAloudError) => {
    wanted.current = false;
    setListening(false);
    onErrorRef.current?.(error);
  }, []);
  /** Aligns what was heard so far; `final`: the reader has stopped. */
  const refresh = useCallback((final: boolean) => {
    const text = join(committed.current, partial.current);
    const from = startRef.current;
    // Before the first word heard, a chosen start still shows where to read from.
    const next =
      text || from > 0 ? alignReading(wordsRef.current, transcriptWords(text), final, from) : null;
    setShown((prev) =>
      prev.page === pageRef.current && sameProgress(prev.progress, next)
        ? prev
        : { page: pageRef.current, progress: next },
    );
  }, []);

  const launch = useCallback(() => {
    heardInSession.current = false;
    accepting.current = true;
    sessionOnDevice.current = onDevice;
    try {
      recognizer!.start({
        lang: LANG,
        interimResults: true,
        continuous: true,
        maxAlternatives: 1,
        requiresOnDeviceRecognition: onDevice,
        contextualStrings: names.slice(0, 100),
      });
    } catch (e) {
      console.warn('speech start', e);
      accepting.current = false;
      fail('failed');
    }
  }, [names, fail]);

  const stopListening = useCallback(() => {
    if (!wanted.current) return;
    wanted.current = false;
    setListening(false);
    refresh(true);
    try {
      recognizer?.stop();
    } catch (e) {
      console.warn('speech stop', e);
    }
  }, [refresh]);

  useEffect(() => {
    if (!recognizer) return;
    const subscriptions = [
      recognizer.addListener('result', (event) => {
        if (!accepting.current) return;
        const text = event.results[0]?.transcript.trim() ?? '';
        if (text) {
          heardInSession.current = true;
          onHeardRef.current?.();
        }
        if (event.isFinal) {
          committed.current = join(committed.current, text);
          partial.current = '';
        } else {
          partial.current = text;
        }
        refresh(!wanted.current);
      }),
      recognizer.addListener('end', () => {
        // A session ended without a final result: keep what it heard.
        if (accepting.current) committed.current = join(committed.current, partial.current);
        partial.current = '';
        accepting.current = false;
        // The on-device recognizer could not start (same reading, network recognizer),
        // or a double tap moved the start: carry on at once, not a silent session.
        if (fallingBack.current) {
          fallingBack.current = false;
          if (wanted.current) {
            launch();
            return;
          }
        }
        silentSessions.current = heardInSession.current ? 0 : silentSessions.current + 1;
        if (wanted.current && silentSessions.current < MAX_SILENT_SESSIONS) {
          launch();
          return;
        }
        wanted.current = false;
        setListening(false);
        refresh(true);
        // Recognition left the audio session in recording mode (voice-over in the earpiece).
        restorePlaybackMode();
      }),
      recognizer.addListener('error', (event) => {
        if (sessionOnDevice.current && ON_DEVICE_UNSUPPORTED.has(event.error)) {
          console.warn('on-device speech unavailable, using the network', event.error);
          onDevice = false;
          fallingBack.current = true;
          void askModelDownload();
          return;
        }
        switch (event.error) {
          // Silence or a stop: `end` follows and restarts or stops.
          case 'no-speech':
          case 'speech-timeout':
          case 'aborted':
            return;
          case 'not-allowed':
            return fail('permission');
          case 'language-not-supported':
          case 'service-not-allowed':
            return fail('unavailable');
          case 'network':
            return fail('network');
          default:
            console.warn('speech error', event.error, event.message);
            return fail('failed');
        }
      }),
    ];
    return () => subscriptions.forEach((s) => s.remove());
  }, [launch, fail, refresh]);

  const reset = useCallback(() => {
    startRef.current = 0;
    committed.current = '';
    partial.current = '';
    refresh(false);
  }, [refresh]);

  /**
   * Starts the reading over from the word holding token `position` (a double tap on a
   * word, where the voice-over plays from too). While listening, the running session
   * is dropped (its transcript holds the words read before) and a new one starts.
   */
  const startAt = useCallback(
    (position: number) => {
      const index = wordsRef.current.findIndex((w) => w.last >= position);
      if (index < 0) return;
      startRef.current = index;
      committed.current = '';
      partial.current = '';
      if (accepting.current) {
        // Its `end` starts the next session while the reader wants to be listened to.
        accepting.current = false;
        fallingBack.current = true;
        silentSessions.current = 0;
        try {
          recognizer?.abort();
        } catch (e) {
          console.warn('speech abort', e);
        }
      }
      refresh(!wanted.current);
    },
    [refresh],
  );

  // A new page (or leaving the reader) stops listening and starts over.
  useEffect(() => {
    pageRef.current = pageKey;
    startRef.current = 0;
    committed.current = '';
    partial.current = '';
    return () => {
      if (!accepting.current && !wanted.current) return;
      wanted.current = false;
      accepting.current = false;
      setListening(false);
      try {
        recognizer?.abort();
      } catch (e) {
        console.warn('speech abort', e);
      }
    };
  }, [pageKey]);

  const start = useCallback(async () => {
    if (!recognizer || wanted.current) return;
    const permission = await recognizer.requestPermissionsAsync().catch(() => null);
    if (!permission?.granted) {
      onErrorRef.current?.('permission');
      return;
    }
    // The page was read to the end: a new reading starts over.
    if (progress?.done) reset();
    wanted.current = true;
    silentSessions.current = 0;
    setListening(true);
    // The previous session is still finishing (stop): its `end` starts the next one.
    if (!accepting.current) launch();
  }, [launch, progress?.done, reset]);

  return {
    /** The device can recognize speech (and the build has the module). */
    available,
    listening,
    /** Null until the first word is heard. */
    progress,
    start,
    stop: stopListening,
    reset,
    startAt,
  };
}
