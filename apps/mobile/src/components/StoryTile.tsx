import { BookOpen, Check, Clock } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import type { StoryProgressSummary } from '@/lib/api/progress';
import { formatNumber, plural, readingMinutes } from '@/lib/labels';
import type { StorySummary } from '@/lib/types';
import { Badge, Card, Icon, ProgressBar, Text, colors, levelColors, spacing } from '@/theme';

type Props = {
  story: StorySummary;
  progress: StoryProgressSummary | undefined;
  onPress: () => void;
};

/** Story card for the home grid: level, title, length and reading progress. */
export function StoryTile({ story, progress, onPress }: Props) {
  const c = levelColors[story.level];
  const fraction = progress?.fraction ?? 0;
  const done = fraction >= 1;

  return (
    <Card onPress={onPress} padding={spacing.md} style={styles.card}>
      <View style={styles.top}>
        <Badge label={story.level} level={story.level} solid />
        {done ? (
          <View style={[styles.done, { backgroundColor: c.solid }]}>
            <Icon icon={Check} size={14} color={colors.textOnColor} />
          </View>
        ) : null}
      </View>

      <Text variant="heading" numberOfLines={2} style={styles.title}>
        {story.title}
      </Text>

      <View style={styles.meta}>
        <Icon icon={BookOpen} size={14} color={colors.textMuted} />
        <Text variant="caption" color={colors.textSecondary}>
          {formatNumber(story.word_count)} mots
        </Text>
      </View>
      <View style={styles.meta}>
        <Icon icon={Clock} size={14} color={colors.textMuted} />
        <Text variant="caption" color={colors.textSecondary}>
          {readingMinutes(story.word_count)} min · {plural(story.chapter_count, 'chap.', 'chap.')}
        </Text>
      </View>

      <View style={styles.progress}>
        <ProgressBar progress={fraction} color={c.solid} height={10} style={styles.flex} />
        <Text variant="caption" color={done ? c.shade : colors.textSecondary}>
          {Math.round(fraction * 100)} %
        </Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  done: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Two lines reserved so tiles of a row stay aligned.
  title: { marginTop: spacing.sm, minHeight: 52 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.xs },
  progress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  flex: { flex: 1 },
});
