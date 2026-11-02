import { useRouter, useFocusEffect } from 'expo-router';
import { Brain, Library, Lock } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { StatsBar } from '@/components/StatsBar';
import { StoryShelf } from '@/components/StoryShelf';
import { useI18n } from '@/i18n';
import { fetchStories } from '@/lib/api/content';
import {
  fetchProgressByStory,
  fetchResumeChapter,
  type StoryProgressSummary,
} from '@/lib/api/progress';
import { countDueVocabulary } from '@/lib/api/vocabulary';
import { usePremium } from '@/lib/premium';
import { useStats } from '@/lib/stats';
import { useTour } from '@/lib/tour';
import type { StorySummary } from '@/lib/types';
import {
  Button,
  CEFR_LEVELS,
  Card,
  Icon,
  Loader,
  Text,
  colors,
  enter,
  radii,
  spacing,
} from '@/theme';

export default function Home() {
  const router = useRouter();
  const { refresh: refreshStats } = useStats();
  const { t } = useI18n();
  const { premium } = usePremium();
  const [stories, setStories] = useState<StorySummary[] | null>(null);
  const [progress, setProgress] = useState(new Map<string, StoryProgressSummary>());
  const [due, setDue] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const { target } = useTour('home', stories !== null);
  // One shelf per level (A1 first), the free stories at the front of each.
  const shelves = useMemo(
    () =>
      CEFR_LEVELS.map((level) => ({
        level,
        stories: (stories ?? [])
          .filter((s) => s.level === level)
          .sort((a, b) => Number(a.premium) - Number(b.premium)),
      })).filter((shelf) => shelf.stories.length),
    [stories],
  );
  // Started and not finished, the last read first.
  const inProgress = useMemo(
    () =>
      (stories ?? [])
        .filter((s) => {
          const p = progress.get(s.id);
          return p?.lastReadAt && p.fraction < 1;
        })
        .sort((a, b) =>
          progress.get(b.id)!.lastReadAt!.localeCompare(progress.get(a.id)!.lastReadAt!),
        ),
    [stories, progress],
  );

  const load = useCallback(async () => {
    try {
      const [s, d] = await Promise.all([fetchStories(), countDueVocabulary(), refreshStats()]);
      const p = await fetchProgressByStory(s);
      setProgress(p);
      setStories(s);
      setDue(d);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [refreshStats]);

  const openStory = (story: StorySummary) =>
    router.push({ pathname: '/story/[id]', params: { id: story.id } });

  /** A story in progress opens where the user left it. */
  async function resume(story: StorySummary) {
    // A premium story without subscription: the story page tells whether the chapter is
    // open (unlocked, or today's unlock) or shows the offer.
    if (story.premium && !premium) return openStory(story);
    const chapter = await fetchResumeChapter(story.id).catch((e: unknown) => {
      console.warn('fetchResumeChapter', e);
      return null;
    });
    if (!chapter) return openStory(story);
    router.push({
      pathname: '/read/[chapterId]',
      params: { chapterId: chapter.id, storyId: story.id },
    });
  }

  // Reload whenever the tab gets focus (e.g. back from a story or a review).
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={colors.primary}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
          />
        }>
        <Text variant="title">{t.home.title}</Text>
        <View ref={target('stats')} collapsable={false}>
          <StatsBar />
        </View>

        {inProgress.length ? (
          <Animated.View entering={enter.up()}>
            <StoryShelf
              title={t.home.inProgress}
              stories={inProgress}
              progress={progress}
              onOpen={resume}
            />
          </Animated.View>
        ) : null}

        {due > 0 ? (
          <Card tint={{ face: colors.infoSoft, edge: colors.info }}>
            <View style={styles.reviewRow}>
              <Icon icon={Brain} size={24} color={colors.infoShade} />
              <Text variant="bodyBold" style={styles.flex}>
                {t.home.toReviewToday(due)}
              </Text>
              <Button
                label={t.home.review}
                colorOverride={{ face: colors.info, edge: colors.infoShade }}
                onPress={() => router.push('/review')}
              />
            </View>
          </Card>
        ) : null}

        {error ? (
          <Card>
            <Text color={colors.danger}>{t.home.loadError(error)}</Text>
            <Button
              label={t.common.retry}
              variant="secondary"
              onPress={load}
              style={styles.retry}
            />
          </Card>
        ) : stories ? (
          stories.length ? (
            <View ref={target('stories')} collapsable={false} style={styles.shelves}>
              {shelves.map((shelf, i) => (
                <Animated.View key={shelf.level} entering={enter.up(i * 80)}>
                  <StoryShelf
                    title={t.levels[shelf.level]}
                    level={shelf.level}
                    stories={shelf.stories}
                    loop
                    progress={progress}
                    onOpen={openStory}
                  />
                </Animated.View>
              ))}
            </View>
          ) : (
            <View style={styles.soon}>
              <Icon icon={Lock} size={16} color={colors.textMuted} />
              <Text variant="caption" color={colors.textMuted}>
                {t.home.comingSoon}
              </Text>
            </View>
          )
        ) : (
          <Loader icon={Library} message={t.loading.stories} style={styles.loader} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.xl, gap: spacing.xl, paddingBottom: spacing.xxxl },
  reviewRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1 },
  retry: { marginTop: spacing.md },
  loader: { marginTop: spacing.xxl },
  shelves: { gap: spacing.xxl },
  soon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.md,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.border,
  },
});
