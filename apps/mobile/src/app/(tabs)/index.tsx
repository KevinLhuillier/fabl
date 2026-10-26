import { router, useFocusEffect } from 'expo-router';
import { Brain, Library, Lock } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { StatsBar } from '@/components/StatsBar';
import { StoryTile } from '@/components/StoryTile';
import { useI18n } from '@/i18n';
import { fetchStories } from '@/lib/api/content';
import { fetchProgressByStory, type StoryProgressSummary } from '@/lib/api/progress';
import { countDueVocabulary } from '@/lib/api/vocabulary';
import { useStats } from '@/lib/stats';
import { useTour } from '@/lib/tour';
import type { StorySummary } from '@/lib/types';
import { Button, Card, Icon, Loader, Text, colors, enter, radii, spacing } from '@/theme';

export default function Home() {
  const { refresh: refreshStats } = useStats();
  const { t } = useI18n();
  const [stories, setStories] = useState<StorySummary[] | null>(null);
  const [progress, setProgress] = useState(new Map<string, StoryProgressSummary>());
  const [due, setDue] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const { target } = useTour('home', stories !== null);

  const load = useCallback(async () => {
    try {
      const [s, d] = await Promise.all([fetchStories(), countDueVocabulary(), refreshStats()]);
      setProgress(await fetchProgressByStory(s));
      setStories(s);
      setDue(d);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [refreshStats]);

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
            <View ref={target('stories')} collapsable={false} style={styles.grid}>
              {stories.map((story, i) => (
                <Animated.View key={story.id} entering={enter.up(i * 50)} style={styles.cell}>
                  <StoryTile
                    story={story}
                    progress={progress.get(story.id)}
                    onPress={() =>
                      router.push({ pathname: '/story/[id]', params: { id: story.id } })
                    }
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
  // Two columns of books; a lone tile keeps half the width instead of stretching.
  grid: { flexDirection: 'row', flexWrap: 'wrap', columnGap: spacing.lg, rowGap: spacing.xl },
  cell: { width: '46.5%', flexGrow: 0 },
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
