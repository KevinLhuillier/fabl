import { router, useFocusEffect } from 'expo-router';
import { Brain, Lock } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { StatsBar } from '@/components/StatsBar';
import { StoryTile } from '@/components/StoryTile';
import { fetchStories } from '@/lib/api/content';
import { fetchProgressByStory, type StoryProgressSummary } from '@/lib/api/progress';
import { countDueVocabulary } from '@/lib/api/vocabulary';
import { LEVEL_NAMES, plural } from '@/lib/labels';
import { useStats } from '@/lib/stats';
import type { StorySummary } from '@/lib/types';
import {
  Button,
  CEFR_LEVELS,
  Card,
  Icon,
  Text,
  colors,
  enter,
  levelColors,
  radii,
  spacing,
} from '@/theme';

export default function Home() {
  const { refresh: refreshStats } = useStats();
  const [stories, setStories] = useState<StorySummary[] | null>(null);
  const [progress, setProgress] = useState(new Map<string, StoryProgressSummary>());
  const [due, setDue] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

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
        <Text variant="title">Tes histoires</Text>
        <StatsBar />

        {due > 0 ? (
          <Card tint={{ face: colors.infoSoft, edge: colors.info }}>
            <View style={styles.reviewRow}>
              <Icon icon={Brain} size={24} color={colors.infoShade} />
              <Text variant="bodyBold" style={styles.flex}>
                {plural(due, 'mot', 'mots')} à réviser aujourd’hui
              </Text>
              <Button
                label="Réviser"
                colorOverride={{ face: colors.info, edge: colors.infoShade }}
                onPress={() => router.push('/review')}
              />
            </View>
          </Card>
        ) : null}

        {error ? (
          <Card>
            <Text color={colors.danger}>Impossible de charger les histoires : {error}</Text>
            <Button label="Réessayer" variant="secondary" onPress={load} style={styles.retry} />
          </Card>
        ) : stories ? (
          CEFR_LEVELS.map((level, li) => {
            const items = stories.filter((s) => s.level === level);
            return (
              <Animated.View key={level} entering={enter.up(li * 50)} style={styles.section}>
                <View style={styles.levelHeader}>
                  <View style={[styles.levelDot, { backgroundColor: levelColors[level].solid }]}>
                    <Text variant="caption" color={colors.textOnColor}>
                      {level}
                    </Text>
                  </View>
                  <Text variant="heading">{LEVEL_NAMES[level]}</Text>
                </View>
                {items.length ? (
                  <View style={styles.grid}>
                    {items.map((story) => (
                      <View key={story.id} style={styles.cell}>
                        <StoryTile
                          story={story}
                          progress={progress.get(story.id)}
                          onPress={() =>
                            router.push({ pathname: '/story/[id]', params: { id: story.id } })
                          }
                        />
                      </View>
                    ))}
                  </View>
                ) : (
                  <View style={styles.soon}>
                    <Icon icon={Lock} size={16} color={colors.textMuted} />
                    <Text variant="caption" color={colors.textMuted}>
                      Bientôt de nouvelles histoires
                    </Text>
                  </View>
                )}
              </Animated.View>
            );
          })
        ) : (
          <ActivityIndicator color={colors.primary} style={styles.loader} />
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
  section: { gap: spacing.md },
  levelHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  levelDot: {
    minWidth: 36,
    height: 28,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Two columns; a lone tile keeps half the width instead of stretching.
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  cell: { width: '47.5%', flexGrow: 0 },
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
