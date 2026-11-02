import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { BookOpen, ChevronLeft, Clock, Crown, Gift } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ConfirmSheet } from '@/components/ConfirmSheet';
import { StoryCover } from '@/components/StoryCover';
import { TableOfContents, type ChapterGate } from '@/components/TableOfContents';
import { useI18n } from '@/i18n';
import { fetchUnlocks, unlockChapter, type Unlocks } from '@/lib/api/allowance';
import { fetchStoryWithChapters } from '@/lib/api/content';
import { fetchChapterProgress } from '@/lib/api/progress';
import { readingMinutes } from '@/lib/labels';
import { usePremium } from '@/lib/premium';
import { useTour } from '@/lib/tour';
import type { ChapterProgress, ChapterSummary, StorySummary } from '@/lib/types';
import {
  Badge,
  Button,
  Card,
  Icon,
  Loader,
  ProgressBar,
  Text,
  colors,
  enter,
  levelColors,
  spacing,
} from '@/theme';

/** A story: cover, summary, overall progress and the table of contents of its chapters. */
export default function StoryScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useI18n();
  const { premium } = usePremium();
  const [story, setStory] = useState<StorySummary | null>(null);
  const [chapters, setChapters] = useState<ChapterSummary[]>([]);
  const [progress, setProgress] = useState(new Map<string, ChapterProgress>());
  const [unlocks, setUnlocks] = useState<Unlocks | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Chapter waiting for the user's go before today's unlock is used on it. */
  const [toUnlock, setToUnlock] = useState<ChapterSummary | null>(null);
  // Kept separate from `toUnlock` so the text stays during the closing fade.
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { target } = useTour('story', story !== null);

  // Reload on focus: coming back from the reader updates the path.
  useFocusEffect(
    useCallback(() => {
      Promise.all([fetchStoryWithChapters(id), fetchChapterProgress(id), fetchUnlocks()])
        .then(([data, p, u]) => {
          setStory(data.story);
          setChapters(data.chapters);
          setProgress(p);
          setUnlocks(u);
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
            <Button label={t.common.back} variant="secondary" onPress={() => router.back()} />
          </View>
        ) : (
          <Loader icon={BookOpen} message={t.loading.story} />
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
  const premiumLocked = story.premium && !premium;
  const gate: ChapterGate | null =
    premiumLocked && unlocks
      ? { unlocked: unlocks.chapterIds, usedToday: unlocks.usedToday }
      : null;
  const openPaywall = () => router.push('/paywall');
  const openChapter = (chapter: ChapterSummary) =>
    router.push({
      pathname: '/read/[chapterId]',
      params: { chapterId: chapter.id, storyId: story.id },
    });

  /** Uses today's unlock on the confirmed chapter, then opens it. */
  async function unlock(chapter: ChapterSummary) {
    setConfirmOpen(false);
    try {
      if ((await unlockChapter(chapter.id)) === 'limit') {
        // Used meanwhile on another device.
        setUnlocks((u) => (u ? { ...u, usedToday: true } : u));
        router.push({ pathname: '/paywall', params: { reason: 'chapter' } });
        return;
      }
      setUnlocks((u) =>
        u ? { chapterIds: new Set(u.chapterIds).add(chapter.id), usedToday: true } : u,
      );
      openChapter(chapter);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={t.common.back}>
          <Icon icon={ChevronLeft} size={30} color={colors.textMuted} />
        </Pressable>
        <View style={styles.badges}>
          {story.premium ? <Badge label={t.premium.badge} icon={Crown} tone="xp" /> : null}
          <Badge label={`${story.level} · ${t.levels[story.level]}`} level={story.level} solid />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Animated.View entering={enter.up()}>
          <View ref={target('summary')} collapsable={false}>
            <Card tint={{ face: c.soft, edge: c.solid }} padding={spacing.lg}>
              <View style={styles.hero}>
                <StoryCover story={story} width={112} size="lg" />
                <View style={styles.heroText}>
                  <Text variant="title">{story.title}</Text>
                  <View style={styles.metaColumn}>
                    <View style={styles.meta}>
                      <Icon icon={BookOpen} size={16} color={c.shade} />
                      <Text variant="caption" color={colors.textSecondary} style={styles.shrink}>
                        {t.common.words(story.word_count)} ·{' '}
                        {t.common.chapters(story.chapter_count)}
                      </Text>
                    </View>
                    <View style={styles.meta}>
                      <Icon icon={Clock} size={16} color={c.shade} />
                      <Text variant="caption" color={colors.textSecondary} style={styles.shrink}>
                        {t.story.readingTime(readingMinutes(story.word_count))}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
              {story.summary ? (
                <Text color={colors.textSecondary} style={styles.summary}>
                  {story.summary}
                </Text>
              ) : null}
              <View style={styles.progressRow}>
                <ProgressBar progress={fraction} color={c.solid} height={12} style={styles.flex} />
                <Text variant="bodyBold" color={c.shade}>
                  {Math.round(fraction * 100)} %
                </Text>
              </View>
            </Card>
          </View>
        </Animated.View>

        {premiumLocked ? (
          <Animated.View entering={enter.up(80)}>
            <Card tint={{ face: colors.xpSoft, edge: colors.xp }}>
              <View style={styles.offerRow}>
                <Icon icon={Crown} size={28} color={colors.xpShade} />
                <View style={styles.flex}>
                  <Text variant="heading">{t.premium.dailyTitle}</Text>
                  <Text color={colors.textSecondary}>
                    {unlocks?.usedToday ? t.premium.dailyUsed : t.premium.dailyAvailable}
                  </Text>
                </View>
              </View>
              <Button
                label={t.premium.upgrade}
                variant="success"
                onPress={openPaywall}
                style={styles.offerButton}
              />
            </Card>
          </Animated.View>
        ) : null}

        <View ref={target('chapters')} collapsable={false}>
          <TableOfContents
            level={story.level}
            chapters={chapters}
            progress={progress}
            gate={gate}
            onPremium={() =>
              router.push({
                pathname: '/paywall',
                params: unlocks?.usedToday ? { reason: 'chapter' } : {},
              })
            }
            onDaily={(chapter) => {
              setToUnlock(chapter);
              setConfirmOpen(true);
            }}
            onOpen={openChapter}
          />
        </View>
        {error ? <Text color={colors.danger}>{error}</Text> : null}
      </ScrollView>
      <ConfirmSheet
        visible={confirmOpen}
        icon={Gift}
        title={t.premium.unlockTitle}
        message={toUnlock ? t.premium.unlockMessage(toUnlock.position + 1, toUnlock.title) : ''}
        confirmLabel={t.premium.unlockConfirm}
        onConfirm={() => toUnlock && unlock(toUnlock)}
        onCancel={() => setConfirmOpen(false)}
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
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  content: { padding: spacing.xl, paddingTop: spacing.sm, gap: spacing.xxl, paddingBottom: 64 },
  hero: { flexDirection: 'row', gap: spacing.lg },
  heroText: { flex: 1, justifyContent: 'center' },
  metaColumn: { gap: spacing.xs, marginTop: spacing.md },
  summary: { marginTop: spacing.lg },
  meta: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  flex: { flex: 1 },
  shrink: { flexShrink: 1 },
  badges: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  offerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  offerButton: { marginTop: spacing.md },
});
