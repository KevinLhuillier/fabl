import { Check } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { useI18n } from '@/i18n';
import type { StoryProgressSummary } from '@/lib/api/progress';
import { readingMinutes } from '@/lib/labels';
import type { StorySummary } from '@/lib/types';
import {
  Badge,
  Icon,
  ProgressBar,
  Text,
  colors,
  depth,
  haptics,
  levelColors,
  spacing,
  usePressDepth,
} from '@/theme';

import { StoryCover } from './StoryCover';

type Props = {
  story: StorySummary;
  progress: StoryProgressSummary | undefined;
  onPress: () => void;
};

/** A story on the home shelf: its cover (with the level), title, length and progress. */
export function StoryTile({ story, progress, onPress }: Props) {
  const { t } = useI18n();
  const c = levelColors[story.level];
  const fraction = progress?.fraction ?? 0;
  const done = fraction >= 1;
  const { faceStyle, pressIn, pressOut } = usePressDepth(depth.card);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t.storyTile.a11y(story.title, story.level, Math.round(fraction * 100))}
      onPressIn={pressIn}
      onPressOut={pressOut}
      onPress={() => {
        haptics.tap();
        onPress();
      }}>
      <Animated.View style={faceStyle}>
        <StoryCover story={story} width="100%" />
        <Badge label={story.level} level={story.level} solid style={styles.level} />
        {done ? (
          <View style={[styles.done, { backgroundColor: c.solid, borderColor: colors.surface }]}>
            <Icon icon={Check} size={14} color={colors.textOnColor} />
          </View>
        ) : null}
      </Animated.View>

      <Text variant="bodyBold" numberOfLines={2} style={styles.title}>
        {story.title}
      </Text>
      <Text variant="caption" color={colors.textSecondary}>
        {t.common.minutes(readingMinutes(story.word_count))} ·{' '}
        {t.common.chapters(story.chapter_count)}
      </Text>

      <View style={styles.progress}>
        <ProgressBar progress={fraction} color={c.solid} height={8} style={styles.flex} />
        <Text variant="caption" color={done ? c.shade : colors.textSecondary}>
          {Math.round(fraction * 100)} %
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  level: { position: 'absolute', top: spacing.sm, left: spacing.md + 2 },
  done: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Two lines reserved so tiles of a row stay aligned.
  title: { marginTop: spacing.md, minHeight: 46 },
  progress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  flex: { flex: 1 },
});
