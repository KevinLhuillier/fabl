import { Clock, Flame, Target } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { useI18n } from '@/i18n';
import { displayedStreak, goalSeconds } from '@/lib/gamification';
import { formatDuration } from '@/lib/labels';
import { useStats } from '@/lib/stats';
import { Badge, Card, Icon, ProgressBar, Text, colors, spacing } from '@/theme';

/** Streak, total practice time and today's goal — shown at the top of the home screen. */
export function StatsBar() {
  const { stats, todaySeconds } = useStats();
  const { t } = useI18n();
  const streak = stats ? displayedStreak(stats) : 0;
  const goal = goalSeconds(stats);
  const reached = todaySeconds >= goal;

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Badge icon={Flame} label={streak} tone="streak" />
        <Badge icon={Clock} label={formatDuration(stats?.total_seconds ?? 0)} tone="xp" />
      </View>
      <Card padding={spacing.md}>
        <View style={styles.goalHeader}>
          <View style={styles.goalTitle}>
            <Icon icon={Target} size={18} color={reached ? colors.successShade : colors.xpShade} />
            <Text variant="bodyBold">{reached ? t.stats.goalReached : t.stats.dailyGoal}</Text>
          </View>
          <Text variant="caption" color={colors.textSecondary}>
            {Math.floor(Math.min(todaySeconds, goal) / 60)} / {goal / 60} min
          </Text>
        </View>
        <ProgressBar
          progress={todaySeconds / goal}
          color={reached ? colors.success : colors.xp}
          height={14}
        />
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  row: { flexDirection: 'row', gap: spacing.sm },
  goalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  goalTitle: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
});
