import { useRouter, useLocalSearchParams } from 'expo-router';
import { BookOpen, Check, ChevronLeft, ChevronRight, Settings, X } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type ScrollViewInstance,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PAGE_AUDIO_SIZE, PageAudio, type PageAudioHandle } from '@/components/PageAudio';
import { PassageText, sentenceAround } from '@/components/PassageText';
import { ReadingSettingsSheet } from '@/components/ReadingSettings';
import { ReadAloudButton } from '@/components/ReadAloudButton';
import { WordSheet, type WordSheetState } from '@/components/WordSheet';
import { useI18n } from '@/i18n';
import { saveChapterTime, takeChapterTime, useActivityTimer } from '@/lib/activity';
import { fetchChapterPages, fetchStoryWithChapters } from '@/lib/api/content';
import {
  completeChapter,
  completeStory,
  fetchChapterProgress,
  isStoryCompleted,
  saveChapterPage,
} from '@/lib/api/progress';
import { addToVocabulary, countWordsToLearn } from '@/lib/api/vocabulary';
import { fetchUnlocks, unlockChapter } from '@/lib/api/allowance';
import { usePremium } from '@/lib/premium';
import { createReadAlongStore, type ReadAlong } from '@/lib/readAlongStore';
import { useStats } from '@/lib/stats';
import type { ChapterProgress, ChapterSummary, Page, StorySummary, Token } from '@/lib/types';
import { useReadAloud } from '@/lib/useReadAloud';
import {
  Button,
  colors,
  enter,
  haptics,
  Icon,
  levelColors,
  Loader,
  ProgressBar,
  radii,
  spacing,
  Text,
  themed,
} from '@/theme';

/** Frame given to the loader before the new page is drawn. */
const TURN_DELAY_MS = 40;
/** The loader shows only when turning the page lasts longer than this. */
const LOADER_DELAY_MS = 200;

type Loaded = {
  story: StorySummary;
  chapters: ChapterSummary[];
  chapter: ChapterSummary;
  pages: Page[];
  progress: Map<string, ChapterProgress>;
  storyCompleted: boolean;
};

/** Reads one chapter, page by page; the reading time counts towards the daily goal. */
export default function ChapterReader() {
  const router = useRouter();
  const { chapterId, storyId } = useLocalSearchParams<{ chapterId: string; storyId: string }>();
  const { stats } = useStats();
  const { premium } = usePremium();
  const {
    touch: touchActivity,
    flush: flushActivity,
    seconds: activitySeconds,
  } = useActivityTimer();
  // Closing the reader before the end keeps the time read for the celebration.
  const finishedRef = useRef(false);
  useEffect(
    () => () => {
      if (!finishedRef.current) void saveChapterTime(chapterId, activitySeconds());
    },
    [chapterId, activitySeconds],
  );
  const { t, lang } = useI18n();
  const readAlongEnabled = stats?.read_along ?? true;
  const playGesture = stats?.play_from_word ?? 'double_tap';

  const [data, setData] = useState<Loaded | null>(null);
  const [page, setPage] = useState(0);
  const [finishing, setFinishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sheet, setSheet] = useState<WordSheetState | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  // Turning the page: the new one is being drawn (a loader covers the text meanwhile).
  const [turning, setTurning] = useState(false);
  const turnTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    // The new page is on screen: take the loader away once it has been painted.
    const frame = requestAnimationFrame(() => setTurning(false));
    return () => cancelAnimationFrame(frame);
  }, [page]);
  useEffect(() => () => clearTimeout(turnTimer.current ?? undefined), []);
  const scrollRef = useRef<ScrollViewInstance>(null);
  const audioRef = useRef<PageAudioHandle>(null);
  // Read-along: which words the voice-over has reached (null when not playing). Kept out of
  // React state: only the words that change re-render, not this screen nor the whole text.
  const [readAlong] = useState(createReadAlongStore);
  const timedRef = useRef<Token[]>([]);
  const onAudioTime = useCallback(
    (ms: number | null) => {
      // Listening to the voice-over is reading too.
      if (ms !== null) touchActivity();
      readAlong.set(ms === null ? null : locate(timedRef.current, ms));
    },
    [touchActivity, readAlong],
  );
  useEffect(() => {
    timedRef.current = data?.pages[page]?.tokens.filter((t) => t.startMs !== null) ?? [];
  }, [data, page]);
  // Stable callbacks: a new function on every render would re-render every word of the
  // text each time the highlight moves (memo defeated), which a low-end phone cannot follow.
  const wordPressRef = useRef<(token: Token) => void>(() => {});
  const onWordPressStable = useCallback((token: Token) => wordPressRef.current(token), []);
  const wordPlayRef = useRef<(token: Token) => void>(() => {});
  const onWordPlay = useCallback((token: Token) => wordPlayRef.current(token), []);

  // Reading the page aloud, with feedback on each word.
  const shownPage = data?.pages[page];
  const readAloud = useReadAloud(shownPage?.tokens ?? NO_TOKENS, shownPage?.id ?? '', {
    onHeard: touchActivity,
    onError: (error) => Alert.alert(t.reader.readAloudErrorTitle, t.reader.readAloudErrors[error]),
  });
  const [voicePlaying, setVoicePlaying] = useState(false);
  // The voice-over and the reading aloud share one place in the page: each starts where
  // the other one, used last, stopped (and its place is the one shown when both stop).
  const [lastUsed, setLastUsed] = useState<'voice' | 'mic' | null>(null);
  const stopReadingAloud = readAloud.stop;
  // Reading aloud was stopped by a word looked up (its sheet would be heard): a double
  // tap on a word carries on reading aloud from there, not the voice-over.
  const micInterrupted = useRef(false);
  const onVoicePlaying = useCallback(
    (playing: boolean) => {
      setVoicePlaying(playing);
      if (!playing) return;
      setLastUsed('voice');
      micInterrupted.current = false;
      // The microphone would hear the voice-over.
      stopReadingAloud();
    },
    [stopReadingAloud],
  );
  const { listening, progress: readAloudProgress } = readAloud;
  // What the text shows. Listening: the reading aloud's feedback. Voice-over playing: its
  // read-along. Otherwise the place of the one used last: the reading aloud's feedback,
  // else where the voice-over stopped, else the word chosen to start from. A store too, fed
  // by the voice-over's without re-rendering this screen.
  const [shownAlong] = useState(createReadAlongStore);
  useEffect(() => {
    const update = () => {
      const voice = readAlongEnabled ? readAlong.get() : null;
      shownAlong.set(
        listening
          ? readAloudProgress
          : voicePlaying
            ? voice
            : lastUsed === 'mic' && readAloudProgress?.heard
              ? readAloudProgress
              : (voice ?? readAloudProgress),
      );
    };
    update();
    return readAlong.subscribe(update);
  }, [readAlong, shownAlong, readAlongEnabled, listening, voicePlaying, lastUsed, readAloudProgress]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetchStoryWithChapters(storyId),
      fetchChapterPages(chapterId, lang),
      fetchChapterProgress(storyId),
      isStoryCompleted(storyId),
    ])
      .then(async ([{ story, chapters }, fetched, progress, storyCompleted]) => {
        if (cancelled) return;
        const chapter = chapters.find((c) => c.id === chapterId);
        let pages = fetched;
        // A premium chapter not unlocked (the database returns no page): today's unlock
        // opens it, else the offer.
        if (chapter && !pages.length && story.premium) {
          if ((await unlockChapter(chapterId)) === 'limit') {
            if (!cancelled) router.replace({ pathname: '/paywall', params: { reason: 'chapter' } });
            return;
          }
          pages = await fetchChapterPages(chapterId, lang);
          if (cancelled) return;
        }
        if (!chapter || !pages.length) throw new Error(t.reader.notFound);
        // Resume where the user left; a finished chapter is replayed from the top.
        const p = progress.get(chapterId);
        setPage(p && !p.completed ? Math.min(p.pageIndex, pages.length - 1) : 0);
        setData({ story, chapters, chapter, pages, progress, storyCompleted });
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [chapterId, storyId, lang, t, router]);

  if (!data) {
    return (
      <SafeAreaView style={[styles.safe, styles.center]}>
        {error ? (
          <View style={styles.errorBox}>
            <Text align="center" color={colors.danger}>
              {error}
            </Text>
            <Button label={t.common.back} variant="secondary" onPress={() => router.back()} />
          </View>
        ) : (
          <Loader icon={BookOpen} message={t.loading.chapter} />
        )}
      </SafeAreaView>
    );
  }

  const { story, chapters, chapter, pages, progress, storyCompleted } = data;
  const current = pages[page]!;
  const isLast = page >= pages.length - 1;
  const level = levelColors[story.level];
  const aligned = !!current.audioUrl && current.tokens.some((t) => t.startMs !== null);

  function toggleReadAloud() {
    touchActivity();
    micInterrupted.current = false;
    if (listening) {
      readAloud.stop();
      return;
    }
    audioRef.current?.pause();
    setSelected(null);
    // Listened to last: the reader carries on after the last word the voice-over said,
    // or from the top once it has played to the end.
    if (lastUsed === 'voice' && aligned) {
      const voice = readAlong.get();
      if (voice && voice.readUpTo >= 0) readAloud.startAt(voice.readUpTo + 1);
      else readAloud.reset();
    }
    setLastUsed('mic');
    void readAloud.start();
  }

  /** Read aloud last: the voice-over starts at the next word to read (null: as usual). */
  function voiceResumeAt(): number | null {
    if (lastUsed !== 'mic' || !readAloudProgress?.heard) return null;
    const next = readAloudProgress.current;
    if (next === null) return null;
    const token = current.tokens.find((t) => t.position >= next && t.startMs !== null);
    return token?.startMs ?? null;
  }

  /**
   * Double tap (or tap, per the setting) on a word: the voice-over and the reading aloud
   * both start from it. While listening, only the reading aloud moves (the voice-over
   * would be heard by the microphone); after a word looked up while listening, reading
   * aloud starts again from there.
   */
  function playFromWord(token: Token) {
    touchActivity();
    setSelected(null);
    readAloud.startAt(token.position);
    if (micInterrupted.current) {
      micInterrupted.current = false;
      audioRef.current?.pause();
      setLastUsed('mic');
      void readAloud.start();
      return;
    }
    if (!listening && aligned && token.startMs !== null) {
      audioRef.current?.playFrom(token.startMs);
    }
  }

  function goTo(target: number) {
    // A page is already being drawn: ignore a second tap.
    if (turning) return;
    touchActivity();
    setTurning(true);
    setSelected(null);
    readAlong.set(null);
    setVoicePlaying(false);
    setLastUsed(null);
    micInterrupted.current = false;
    // Long pages: always start reading the target one from the top.
    scrollRef.current?.scrollTo({ y: 0, animated: false });
    saveChapterPage(chapterId, target).catch((e) => console.warn('saveChapterPage', e));
    // Drawing a page keeps a slow phone busy for a moment: give the loader a frame to be
    // handed to the screen first (its fade-in then runs natively, whatever JS is doing).
    turnTimer.current = setTimeout(() => setPage(target), TURN_DELAY_MS);
  }

  async function finish() {
    setFinishing(true);
    await completeChapter(chapterId).catch((e) => console.warn('completeChapter', e));
    // The celebration shows today's goal: send the time read first.
    await flushActivity();
    finishedRef.current = true;
    // Time read in this chapter, earlier sessions included.
    const seconds = String((await takeChapterTime(chapterId)) + activitySeconds());
    // Words and expressions of this chapter the user looked up and has not reviewed yet.
    const lemmaIds = [
      ...new Set(pages.flatMap((p) => p.tokens.flatMap((t) => [t.lemma?.id, t.phrase?.lemma.id]))),
    ].filter((id): id is number => id !== undefined);
    const newWords = await countWordsToLearn(lemmaIds).catch((e) => {
      console.warn('countWordsToLearn', e);
      return 0;
    });

    // Last unfinished chapter of the story → big celebration.
    const storyDone = chapters.every((c) => c.id === chapterId || progress.get(c.id)?.completed);
    if (storyDone && !storyCompleted) {
      await completeStory(story.id).catch((e) => console.warn('completeStory', e));
      router.replace({
        pathname: '/celebration',
        params: {
          kind: 'story',
          seconds,
          title: story.title,
          newWords: String(newWords),
        },
      });
      return;
    }

    const nextChapter = chapters[chapters.indexOf(chapter) + 1];
    // Free account in a premium story: the next chapter waits for tomorrow's unlock.
    let nextLocked = false;
    if (nextChapter && story.premium && !premium) {
      const unlocks = await fetchUnlocks().catch((e: unknown) => {
        console.warn('fetchUnlocks', e);
        return null;
      });
      nextLocked = !!unlocks && unlocks.usedToday && !unlocks.chapterIds.has(nextChapter.id);
    }
    router.replace({
      pathname: '/celebration',
      params: {
        kind: 'chapter',
        seconds,
        title: t.reader.chapterTitle(chapter.position + 1, chapter.title),
        newWords: String(newWords),
        ...(nextChapter ? { nextChapterId: nextChapter.id, storyId: story.id } : {}),
        ...(nextLocked ? { nextLocked: '1' } : {}),
      },
    });
  }

  // Latest handler for the stable callback; it is defined after the early return, where no
  // hook (effect) can run, and is only ever called from a press, never during render.
  // eslint-disable-next-line react-hooks/refs
  wordPressRef.current = onWordPress;
  // eslint-disable-next-line react-hooks/refs
  wordPlayRef.current = playFromWord;
  function onWordPress(token: Token) {
    touchActivity();
    if (!token.lemma) return;
    // The word's pronunciation in the sheet must not be heard as the reader's voice.
    if (listening) micInterrupted.current = true;
    readAloud.stop();
    const lemma = token.lemma;
    // A word of an expression adds the expression ("shut up"), not the word alone.
    const phrase = token.phrase?.lemma ?? null;
    const entry = phrase ?? lemma;
    setSelected(token.position);
    setSheet({ surface: token.text, lemma, phrase, added: null });
    addToVocabulary({
      lemmaId: entry.id,
      contextSentence: sentenceAround(current.tokens, token.position),
      storyId: story.id,
      passageId: current.id,
      tokenPosition: token.phrase?.start ?? token.position,
    })
      .then((added) =>
        setSheet((s) => (s && (s.phrase ?? s.lemma).id === entry.id ? { ...s, added } : s)),
      )
      .catch((e) => console.warn('addToVocabulary', e));
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={t.reader.close}>
          <Icon icon={X} size={28} color={colors.textMuted} />
        </Pressable>
        <ProgressBar progress={(page + 1) / pages.length} color={level.solid} style={styles.flex} />
        {/* Stays in view while scrolling, unlike the caption above the text. */}
        <Text variant="caption" color={level.ink} style={styles.pageCount}>
          {page + 1}/{pages.length}
        </Text>
      </View>

      <View style={styles.flex}>
        <ScrollView
          ref={scrollRef}
          onScrollBeginDrag={touchActivity}
          contentContainerStyle={styles.body}>
          <Text variant="caption" color={level.ink}>
            {t.reader.header(chapter.position + 1, chapter.title, page + 1, pages.length)}
          </Text>
          <Animated.View key={current.id} entering={enter.up()}>
            <View>
              <PassageText
                tokens={current.tokens}
                written={current.written}
                selectedPosition={selected}
                onWordPress={onWordPressStable}
                readAlong={shownAlong}
                readColor={level.ink}
                currentColor={level.soft}
                onWordPlay={aligned || readAloud.available ? onWordPlay : undefined}
                playUntimed={readAloud.available}
                playGesture={playGesture}
              />
            </View>
          </Animated.View>
        </ScrollView>
        {/* Appears only if the page takes a while (slow phone): no flash on a quick one. */}
        {turning ? (
          <Animated.View entering={enter.fade(LOADER_DELAY_MS)} style={styles.turning}>
            <ActivityIndicator size="large" color={level.solid} />
          </Animated.View>
        ) : null}
        {listening && !readAloudProgress ? (
          <View style={styles.listeningWrap} pointerEvents="none">
            <Animated.View entering={enter.fade()} style={styles.listeningHint}>
              <Text variant="caption" color={level.ink}>
                {t.reader.listening}
              </Text>
            </Animated.View>
          </View>
        ) : null}
      </View>

      <View style={styles.footer}>
        {/* Equal sides: the settings and the voice-over stay centered whatever the arrows. */}
        <View style={styles.side}>
          {page > 0 && !finishing ? (
            <Pressable
              onPress={() => goTo(page - 1)}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={t.reader.previousPage}>
              <Icon icon={ChevronLeft} size={36} color={level.ink} />
            </Pressable>
          ) : null}
        </View>
        <View style={styles.controls}>
          <Pressable
            onPress={() => {
              haptics.tap();
              setSettingsOpen(true);
            }}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t.reader.settings}
            style={({ pressed }) => [styles.settings, pressed && styles.pressed]}>
            <Icon icon={Settings} size={24} color={colors.textSecondary} />
          </Pressable>
          {readAloud.available ? (
            <ReadAloudButton
              listening={listening}
              color={level.solid}
              shade={level.shade}
              ink={level.ink}
              onPress={toggleReadAloud}
            />
          ) : null}
          {current.audioUrl ? (
            <View>
              <PageAudio
                key={`audio-${current.id}`}
                uri={current.audioUrl}
                color={level.solid}
                shade={level.shade}
                // Followed even without the highlighting: the reading aloud resumes there.
                onTime={aligned ? onAudioTime : undefined}
                onPlayingChange={onVoicePlaying}
                resumeAt={aligned ? voiceResumeAt : undefined}
                // Replaying from the start: back to the top to follow the voice.
                onRestart={() => scrollRef.current?.scrollTo({ y: 0, animated: true })}
                ref={audioRef}
              />
            </View>
          ) : null}
        </View>
        <View style={[styles.side, styles.sideEnd]}>
          {finishing ? (
            <ActivityIndicator color={colors.success} />
          ) : isLast ? (
            // Last page: the next arrow becomes "finish the chapter".
            <Pressable
              onPress={() => {
                haptics.press();
                finish();
              }}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t.reader.finish}
              style={({ pressed }) => [styles.finish, pressed && styles.finishPressed]}>
              <Icon icon={Check} size={26} color={colors.textOnColor} />
            </Pressable>
          ) : (
            <Pressable
              onPress={() => goTo(page + 1)}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={t.reader.nextPage}>
              <Icon icon={ChevronRight} size={36} color={level.ink} />
            </Pressable>
          )}
        </View>
      </View>

      <ReadingSettingsSheet visible={settingsOpen} onClose={() => setSettingsOpen(false)} />

      <WordSheet
        word={sheet}
        onClose={() => {
          setSheet(null);
          setSelected(null);
        }}
        onSpeak={() => {
          audioRef.current?.pause();
          if (listening) micInterrupted.current = true;
          readAloud.stop();
        }}
      />
    </SafeAreaView>
  );
}

const NO_TOKENS: Token[] = [];

/** The highlight runs this much ahead of the voice: the time it takes to show. */
const LEAD_MS = 60;
/** After a word, its highlight stays through a short silence (a comma, a breath). */
const HOLD_MS = 600;

/**
 * Last timed word reached at `ms`, and whether it is being spoken right now. A word
 * stays current until the next one starts (or a long silence), so the highlight
 * never blinks off between two words.
 */
function locate(timed: Token[], ms: number): ReadAlong {
  const at = ms + LEAD_MS;
  let last: Token | null = null;
  for (const t of timed) {
    if (t.startMs! > at) break;
    last = t;
  }
  return {
    readUpTo: last?.position ?? -1,
    current: last && at <= last.endMs! + HOLD_MS ? last.position : null,
  };
}

const styles = themed(() =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    center: { alignItems: 'center', justifyContent: 'center' },
    errorBox: { padding: spacing.xl, gap: spacing.lg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.lg,
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.md,
    },
    flex: { flex: 1 },
    // Fixed width so the bar does not jump when the page number gains a digit.
    pageCount: { minWidth: 40, textAlign: 'right', fontVariant: ['tabular-nums'] },
    body: { padding: spacing.xl, gap: spacing.lg, paddingBottom: spacing.xxxl },
    turning: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.background,
    },
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.md,
      // Same height with or without a voice-over on the page.
      minHeight: PAGE_AUDIO_SIZE + spacing.md * 2,
      borderTopWidth: 2,
      borderTopColor: colors.border,
      backgroundColor: colors.surface,
    },
    side: { flex: 1, flexDirection: 'row', alignItems: 'center' },
    sideEnd: { justifyContent: 'flex-end' },
    controls: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
    settings: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.background,
      borderWidth: 2,
      borderColor: colors.border,
    },
    pressed: { opacity: 0.6 },
    // "Read the page aloud…" until the first word is heard, over the bottom of the text.
    listeningWrap: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: spacing.lg,
      alignItems: 'center',
    },
    listeningHint: {
      backgroundColor: colors.surface,
      borderRadius: radii.pill,
      borderWidth: 2,
      borderColor: colors.border,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
    },
    // Round and raised like the voice-over button, in the success green.
    finish: {
      width: 52,
      height: 52,
      borderRadius: 26,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.success,
      borderBottomWidth: 4,
      borderBottomColor: colors.successShade,
    },
    finishPressed: { borderBottomWidth: 1, transform: [{ translateY: 3 }] },
  }),
);
