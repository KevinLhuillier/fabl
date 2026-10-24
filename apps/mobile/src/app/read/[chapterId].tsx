import { router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, ChevronRight, Lightbulb, X } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
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
import { useStats } from '@/lib/stats';
import { useTour } from '@/lib/tour';
import type { ChapterProgress, ChapterSummary, Page, StorySummary, Token } from '@/lib/types';
import { Button, Icon, ProgressBar, Text, colors, enter, levelColors, spacing } from '@/theme';

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
  }, [chapterId, storyId, lang, t]);

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
          <ActivityIndicator color={colors.primary} />
        )}
      </SafeAreaView>
    );
  }

  const { story, chapters, chapter, pages, progress, storyCompleted } = data;
  const current = pages[page]!;
  const isLast = page >= pages.length - 1;
  const level = levelColors[story.level];
  const aligned = !!current.audioUrl && current.tokens.some((t) => t.startMs !== null);

  function goTo(target: number) {
    touchActivity();
    setPage(target);
    setSelected(null);
    setReadAlong(null);
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
    })
      .then((isNew) =>
        setSheet((s) =>
          s && (s.phrase ?? s.lemma).id === entry.id
            ? { ...s, added: isNew ? 'new' : 'existing' }
            : s,
        ),
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
      </View>

      <View style={styles.flex}>
        <ScrollView
          ref={scrollRef}
          onScrollBeginDrag={touchActivity}
          contentContainerStyle={[styles.body, current.audioUrl ? styles.bodyWithAudio : null]}>
          <Text variant="caption" color={level.shade}>
            {t.reader.header(chapter.position + 1, chapter.title, page + 1, pages.length)}
          </Text>
          <Animated.View key={current.id} entering={enter.up()}>
            <View ref={target('text')} collapsable={false}>
              <PassageText
                tokens={current.tokens}
                selectedPosition={selected}
                onWordPress={onWordPress}
                readAlong={readAlongEnabled ? readAlong : null}
                readColor={level.shade}
                currentColor={level.soft}
                onWordDoubleTap={
                  aligned
                    ? (t) => t.startMs !== null && audioRef.current?.playFrom(t.startMs)
                    : undefined
                }
              />
            </View>
          </Animated.View>
          {aligned && page === 0 ? (
            <View style={styles.hint}>
              <Icon icon={Lightbulb} size={16} color={colors.textMuted} />
              <Text variant="caption" color={colors.textMuted}>
                {t.reader.doubleTapHint}
              </Text>
            </View>
          ) : null}
          {chapter.position === 0 && page === 0 ? (
            <Animated.View entering={enter.fade(600)} style={styles.hint}>
              <Icon icon={Lightbulb} size={16} color={colors.textMuted} />
              <Text variant="caption" color={colors.textMuted}>
                {t.reader.tapHint}
              </Text>
            </Animated.View>
          ) : null}
        </ScrollView>
        {/* Floating over the text, so the voice-over can be paused at any scroll position. */}
        {current.audioUrl ? (
          <View ref={target('audio')} collapsable={false} style={styles.audio}>
            <PageAudio
              key={`audio-${current.id}`}
              uri={current.audioUrl}
              color={level.solid}
              shade={level.shade}
              onTime={aligned && readAlongEnabled ? onAudioTime : undefined}
              ref={audioRef}
            />
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
            <ActivityIndicator color={colors.primary} />
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
      />
    </SafeAreaView>
  );
}

/** Last timed word reached at `ms`, and whether it is being spoken right now. */
function locate(timed: Token[], ms: number): ReadAlong {
  let last: Token | null = null;
  for (const t of timed) {
    if (t.startMs! > ms) break;
    last = t;
  }
  return {
    readUpTo: last?.position ?? -1,
    current: last && ms <= last.endMs! ? last.position : null,
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
  body: { padding: spacing.xl, gap: spacing.lg, paddingBottom: spacing.xxxl },
  // Room under the last line so the floating player never hides it.
  bodyWithAudio: { paddingBottom: PAGE_AUDIO_SIZE + spacing.xl * 2 },
  audio: { position: 'absolute', right: spacing.xl, bottom: spacing.lg },
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
