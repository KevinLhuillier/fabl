import { useRouter, useLocalSearchParams } from 'expo-router';
import { BookOpen, ChevronLeft, ChevronRight, Lightbulb, X } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
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
import { PassageText, sentenceAround, type ReadAlong } from '@/components/PassageText';
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
import { isFreeChapter } from '@/lib/premium';
import { useStats } from '@/lib/stats';
import { useTour } from '@/lib/tour';
import type { ChapterProgress, ChapterSummary, Page, StorySummary, Token } from '@/lib/types';
import { useReadAloud } from '@/lib/useReadAloud';
import {
  Button,
  Icon,
  Loader,
  ProgressBar,
  Text,
  colors,
  enter,
  levelColors,
  radii,
  spacing,
} from '@/theme';

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
  const { target } = useTour('reader', data !== null);
  const [sheet, setSheet] = useState<WordSheetState | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const scrollRef = useRef<ScrollViewInstance>(null);
  const audioRef = useRef<PageAudioHandle>(null);
  // Read-along: which words the voice-over has reached (null when not playing).
  const [readAlong, setReadAlong] = useState<ReadAlong | null>(null);
  const timedRef = useRef<Token[]>([]);
  const onAudioTime = useCallback(
    (ms: number | null) => {
      // Listening to the voice-over is reading too.
      if (ms !== null) touchActivity();
      const next = ms === null ? null : locate(timedRef.current, ms);
      // Re-render the text only when the highlighted word changes, not on every tick.
      setReadAlong((prev) =>
        prev?.readUpTo === next?.readUpTo && prev?.current === next?.current ? prev : next,
      );
    },
    [touchActivity],
  );
  useEffect(() => {
    timedRef.current = data?.pages[page]?.tokens.filter((t) => t.startMs !== null) ?? [];
  }, [data, page]);

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
  const onVoicePlaying = useCallback(
    (playing: boolean) => {
      setVoicePlaying(playing);
      if (!playing) return;
      setLastUsed('voice');
      // The microphone would hear the voice-over.
      stopReadingAloud();
    },
    [stopReadingAloud],
  );

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetchStoryWithChapters(storyId),
      fetchChapterPages(chapterId, lang),
      fetchChapterProgress(storyId),
      isStoryCompleted(storyId),
    ])
      .then(([{ story, chapters }, pages, progress, storyCompleted]) => {
        if (cancelled) return;
        const chapter = chapters.find((c) => c.id === chapterId);
        // A premium chapter without subscription: the database returns no page.
        if (chapter && !pages.length && !isFreeChapter(story.premium, chapter.position)) {
          router.replace('/paywall');
          return;
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
  const { listening, progress: readAloudProgress } = readAloud;
  const voiceAlong = readAlongEnabled ? readAlong : null;
  // Listening: the reading aloud's feedback. Voice-over playing: its read-along.
  // Otherwise the place of the one used last: the reading aloud's feedback, else where
  // the voice-over stopped, else the word chosen to start from.
  const shownAlong: ReadAlong | null = listening
    ? readAloudProgress
    : voicePlaying
      ? voiceAlong
      : lastUsed === 'mic' && readAloudProgress?.heard
        ? readAloudProgress
        : (voiceAlong ?? readAloudProgress);
  const floating = !!current.audioUrl || readAloud.available;

  function toggleReadAloud() {
    touchActivity();
    if (listening) {
      readAloud.stop();
      return;
    }
    audioRef.current?.pause();
    setSelected(null);
    // Listened to last: the reader carries on after the last word the voice-over said,
    // or from the top once it has played to the end.
    if (lastUsed === 'voice' && aligned) {
      if (readAlong && readAlong.readUpTo >= 0) readAloud.startAt(readAlong.readUpTo + 1);
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
   * would be heard by the microphone).
   */
  function playFromWord(token: Token) {
    touchActivity();
    setSelected(null);
    readAloud.startAt(token.position);
    if (!listening && aligned && token.startMs !== null) {
      audioRef.current?.playFrom(token.startMs);
    }
  }

  function goTo(target: number) {
    touchActivity();
    setPage(target);
    setSelected(null);
    setReadAlong(null);
    setVoicePlaying(false);
    setLastUsed(null);
    // Long pages: always start reading the target one from the top.
    scrollRef.current?.scrollTo({ y: 0, animated: false });
    saveChapterPage(chapterId, target).catch((e) => console.warn('saveChapterPage', e));
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
    router.replace({
      pathname: '/celebration',
      params: {
        kind: 'chapter',
        seconds,
        title: t.reader.chapterTitle(chapter.position + 1, chapter.title),
        newWords: String(newWords),
        ...(nextChapter ? { nextChapterId: nextChapter.id, storyId: story.id } : {}),
      },
    });
  }

  function onWordPress(token: Token) {
    touchActivity();
    if (!token.lemma) return;
    // The word's pronunciation in the sheet must not be heard as the reader's voice.
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
        <Text variant="caption" color={level.shade} style={styles.pageCount}>
          {page + 1}/{pages.length}
        </Text>
      </View>

      <View style={styles.flex}>
        <ScrollView
          ref={scrollRef}
          onScrollBeginDrag={touchActivity}
          contentContainerStyle={[styles.body, floating ? styles.bodyWithAudio : null]}>
          <Text variant="caption" color={level.shade}>
            {t.reader.header(chapter.position + 1, chapter.title, page + 1, pages.length)}
          </Text>
          <Animated.View key={current.id} entering={enter.up()}>
            <View ref={target('text')} collapsable={false}>
              <PassageText
                tokens={current.tokens}
                written={current.written}
                selectedPosition={selected}
                onWordPress={onWordPress}
                readAlong={shownAlong}
                readColor={level.shade}
                currentColor={level.soft}
                onWordPlay={aligned || readAloud.available ? playFromWord : undefined}
                playUntimed={readAloud.available}
                playGesture={playGesture}
              />
            </View>
          </Animated.View>
          {aligned && page === 0 ? (
            <View style={styles.hint}>
              <Icon icon={Lightbulb} size={16} color={colors.textMuted} />
              <Text variant="caption" color={colors.textMuted}>
                {playGesture === 'tap' ? t.reader.tapPlayHint : t.reader.doubleTapHint}
              </Text>
            </View>
          ) : null}
          {chapter.position === 0 && page === 0 ? (
            <Animated.View entering={enter.fade(600)} style={styles.hint}>
              <Icon icon={Lightbulb} size={16} color={colors.textMuted} />
              <Text variant="caption" color={colors.textMuted}>
                {aligned && playGesture === 'tap'
                  ? t.reader.doubleTapTranslateHint
                  : t.reader.tapHint}
              </Text>
            </Animated.View>
          ) : null}
        </ScrollView>
        {/* Floating over the text, so the voice-over can be paused at any scroll position. */}
        {floating ? (
          <View style={styles.audio} pointerEvents="box-none">
            {listening && !readAloudProgress ? (
              <Animated.View entering={enter.fade()} style={styles.listeningHint}>
                <Text variant="caption" color={level.shade}>
                  {t.reader.listening}
                </Text>
              </Animated.View>
            ) : null}
            {readAloud.available ? (
              <ReadAloudButton
                listening={listening}
                color={level.solid}
                shade={level.shade}
                onPress={toggleReadAloud}
              />
            ) : null}
            {current.audioUrl ? (
              <View ref={target('audio')} collapsable={false}>
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
        ) : null}
      </View>

      <View style={styles.footer}>
        {/* Fixed-width slots so the main button keeps its place when an arrow is hidden. */}
        <View style={styles.arrowSlot}>
          {page > 0 && !finishing ? (
            <Pressable
              onPress={() => goTo(page - 1)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t.reader.previousPage}>
              <Icon icon={ChevronLeft} size={32} color={level.shade} />
            </Pressable>
          ) : null}
        </View>
        <View ref={target('next')} collapsable={false} style={styles.flex}>
          {finishing ? (
            <Loader style={styles.footerLoader} />
          ) : isLast ? (
            <Button label={t.reader.finish} variant="success" onPress={finish} />
          ) : (
            <Button
              label={t.common.continue}
              colorOverride={{ face: level.solid, edge: level.shade }}
              onPress={() => goTo(page + 1)}
            />
          )}
        </View>
        <View style={styles.arrowSlot}>
          {!isLast && !finishing ? (
            <Pressable
              onPress={() => goTo(page + 1)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t.reader.nextPage}>
              <Icon icon={ChevronRight} size={32} color={level.shade} />
            </Pressable>
          ) : null}
        </View>
      </View>

      <WordSheet
        word={sheet}
        onClose={() => {
          setSheet(null);
          setSelected(null);
        }}
        onSpeak={() => {
          audioRef.current?.pause();
          readAloud.stop();
        }}
        onUpgrade={() => {
          setSheet(null);
          setSelected(null);
          audioRef.current?.pause();
          router.push('/paywall');
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

const styles = StyleSheet.create({
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
  footerLoader: { padding: 0 },
  // Fixed width so the bar does not jump when the page number gains a digit.
  pageCount: { minWidth: 40, textAlign: 'right', fontVariant: ['tabular-nums'] },
  body: { padding: spacing.xl, gap: spacing.lg, paddingBottom: spacing.xxxl },
  // Room under the last line so the floating player never hides it.
  bodyWithAudio: { paddingBottom: PAGE_AUDIO_SIZE + spacing.xl * 2 },
  audio: {
    position: 'absolute',
    right: spacing.xl,
    bottom: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  listeningHint: {
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  hint: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.xl,
    paddingTop: spacing.md,
    borderTopWidth: 2,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  arrowSlot: { width: 32, alignItems: 'center' },
});
