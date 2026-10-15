import { router, useLocalSearchParams } from 'expo-router';
import { Lightbulb, X } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PassageText, sentenceAround } from '@/components/PassageText';
import { WordSheet, type WordSheetState } from '@/components/WordSheet';
import { fetchChapterPages, fetchStoryWithChapters } from '@/lib/api/content';
import {
  completeChapter,
  completeStory,
  fetchChapterProgress,
  isStoryCompleted,
  saveChapterPage,
} from '@/lib/api/progress';
import { addToVocabulary } from '@/lib/api/vocabulary';
import { XP_RULES } from '@/lib/gamification';
import { useStats } from '@/lib/stats';
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

/** Reads one chapter, page by page; XP are awarded when the chapter is finished. */
export default function ChapterReader() {
  const { chapterId, storyId } = useLocalSearchParams<{ chapterId: string; storyId: string }>();
  const { award } = useStats();

  const [data, setData] = useState<Loaded | null>(null);
  const [page, setPage] = useState(0);
  const [finishing, setFinishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sheet, setSheet] = useState<WordSheetState | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetchStoryWithChapters(storyId),
      fetchChapterPages(chapterId),
      fetchChapterProgress(storyId),
      isStoryCompleted(storyId),
    ])
      .then(([{ story, chapters }, pages, progress, storyCompleted]) => {
        if (cancelled) return;
        const chapter = chapters.find((c) => c.id === chapterId);
        if (!chapter || !pages.length)
          throw new Error('Chapitre introuvable : republie l’histoire.');
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
  }, [chapterId, storyId]);

  if (!data) {
    return (
      <SafeAreaView style={[styles.safe, styles.center]}>
        {error ? (
          <View style={styles.errorBox}>
            <Text align="center" color={colors.danger}>
              {error}
            </Text>
            <Button label="Retour" variant="secondary" onPress={() => router.back()} />
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

  function next() {
    const target = page + 1;
    setPage(target);
    setSelected(null);
    // Long pages: always start reading the next one from the top.
    scrollRef.current?.scrollTo({ y: 0, animated: false });
    saveChapterPage(chapterId, target).catch((e) => console.warn('saveChapterPage', e));
  }

  async function finish() {
    setFinishing(true);
    const replay = !!progress.get(chapterId)?.completed;
    const chapterXp = replay ? XP_RULES.chapterReplay : XP_RULES.chapterFirstCompletion;
    await completeChapter(chapterId).catch((e) => console.warn('completeChapter', e));
    await award('chapter', chapterXp);

    // Last unfinished chapter of the story → story bonus + big celebration.
    const storyDone = chapters.every((c) => c.id === chapterId || progress.get(c.id)?.completed);
    if (storyDone && !storyCompleted) {
      await completeStory(story.id).catch((e) => console.warn('completeStory', e));
      await award('story', XP_RULES.storyCompletionBonus);
      router.replace({
        pathname: '/celebration',
        params: {
          kind: 'story',
          xp: String(chapterXp + XP_RULES.storyCompletionBonus),
          title: story.title,
        },
      });
      return;
    }

    const nextChapter = chapters[chapters.indexOf(chapter) + 1];
    router.replace({
      pathname: '/celebration',
      params: {
        kind: 'chapter',
        xp: String(chapterXp),
        title: `Chapitre ${chapter.position + 1} · ${chapter.title}`,
        ...(nextChapter ? { nextChapterId: nextChapter.id, storyId: story.id } : {}),
      },
    });
  }

  function onWordPress(token: Token) {
    if (!token.lemma) return;
    const lemma = token.lemma;
    setSelected(token.position);
    setSheet({ surface: token.text, lemma, added: null });
    addToVocabulary({
      lemmaId: lemma.id,
      contextSentence: sentenceAround(current.tokens, token.position),
      storyId: story.id,
    })
      .then((isNew) =>
        setSheet((s) =>
          s && s.lemma.id === lemma.id ? { ...s, added: isNew ? 'new' : 'existing' } : s,
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
          accessibilityLabel="Fermer le chapitre">
          <Icon icon={X} size={28} color={colors.textMuted} />
        </Pressable>
        <ProgressBar progress={(page + 1) / pages.length} color={level.solid} style={styles.flex} />
      </View>

      <ScrollView ref={scrollRef} contentContainerStyle={styles.body}>
        <Text variant="caption" color={level.shade}>
          CHAPITRE {chapter.position + 1} · {chapter.title.toUpperCase()} · PAGE {page + 1}/
          {pages.length}
        </Text>
        <Animated.View key={current.id} entering={enter.up()}>
          <PassageText
            tokens={current.tokens}
            selectedPosition={selected}
            onWordPress={onWordPress}
          />
        </Animated.View>
        {chapter.position === 0 && page === 0 ? (
          <Animated.View entering={enter.fade(600)} style={styles.hint}>
            <Icon icon={Lightbulb} size={16} color={colors.textMuted} />
            <Text variant="caption" color={colors.textMuted}>
              Touche un mot pour voir sa traduction
            </Text>
          </Animated.View>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        {finishing ? (
          <ActivityIndicator color={colors.primary} />
        ) : isLast ? (
          <Button label="Terminer le chapitre" variant="success" onPress={finish} />
        ) : (
          <Button
            label="Continuer"
            colorOverride={{ face: level.solid, edge: level.shade }}
            onPress={next}
          />
        )}
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
  hint: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs },
  footer: {
    padding: spacing.xl,
    paddingTop: spacing.md,
    borderTopWidth: 2,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
});
