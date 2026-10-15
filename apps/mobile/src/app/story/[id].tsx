import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { BookOpen, ChevronLeft, Clock } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ChapterPath } from '@/components/ChapterPath';
import { fetchStoryWithChapters } from '@/lib/api/content';
import { fetchChapterProgress } from '@/lib/api/progress';
import { LEVEL_NAMES, formatNumber, plural, readingMinutes } from '@/lib/labels';
import type { ChapterProgress, ChapterSummary, StorySummary } from '@/lib/types';
import {
  Badge,
  Button,
  Card,
  Icon,
  ProgressBar,
  Text,
  colors,
  enter,
  levelColors,
  spacing,
} from '@/theme';

/** A story: summary, overall progress and the zigzag path of its chapters. */
export default function StoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [story, setStory] = useState<StorySummary | null>(null);
  const [chapters, setChapters] = useState<ChapterSummary[]>([]);
  const [progress, setProgress] = useState(new Map<string, ChapterProgress>());
  const [error, setError] = useState<string | null>(null);

  // Reload on focus: coming back from the reader updates the path.
  useFocusEffect(
    useCallback(() => {
      Promise.all([fetchStoryWithChapters(id), fetchChapterProgress(id)])
        .then(([data, p]) => {
          setStory(data.story);
          setChapters(data.chapters);
          setProgress(p);
          setError(null);
        })
        .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
    }, [id]),
  );

  if (!story) {
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

  const c = levelColors[story.level];
  const pagesRead = chapters.reduce((n, ch) => {
    const p = progress.get(ch.id);
    return n + (p?.completed ? ch.pageCount : (p?.pageIndex ?? 0));
  }, 0);
  const fraction = story.passage_count ? Math.min(1, pagesRead / story.passage_count) : 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Retour">
          <Icon icon={ChevronLeft} size={30} color={colors.textMuted} />
        </Pressable>
        <Badge label={`${story.level} · ${LEVEL_NAMES[story.level]}`} level={story.level} solid />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Animated.View entering={enter.up()}>
          <Card tint={{ face: c.soft, edge: c.solid }} padding={spacing.lg}>
            <Text variant="title">{story.title}</Text>
            <Text color={colors.textSecondary} style={styles.summary}>
              {story.summary}
            </Text>
            <View style={styles.metaRow}>
              <View style={styles.meta}>
                <Icon icon={BookOpen} size={16} color={c.shade} />
                <Text variant="caption" color={colors.textSecondary}>
                  {formatNumber(story.word_count)} mots ·{' '}
                  {plural(story.chapter_count, 'chapitre', 'chapitres')}
                </Text>
              </View>
              <View style={styles.meta}>
                <Icon icon={Clock} size={16} color={c.shade} />
                <Text variant="caption" color={colors.textSecondary}>
                  ≈ {readingMinutes(story.word_count)} min
                </Text>
              </View>
            </View>
            <View style={styles.progressRow}>
              <ProgressBar progress={fraction} color={c.solid} height={12} style={styles.flex} />
              <Text variant="bodyBold" color={c.shade}>
                {Math.round(fraction * 100)} %
              </Text>
            </View>
          </Card>
        </Animated.View>

        <ChapterPath
          level={story.level}
          chapters={chapters}
          progress={progress}
          onOpen={(chapter) =>
            router.push({
              pathname: '/read/[chapterId]',
              params: { chapterId: chapter.id, storyId: story.id },
            })
          }
        />
      </ScrollView>
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
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  content: { padding: spacing.xl, paddingTop: spacing.sm, gap: spacing.xxl, paddingBottom: 64 },
  summary: { marginTop: spacing.sm },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg, marginTop: spacing.md },
  meta: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  flex: { flex: 1 },
});
