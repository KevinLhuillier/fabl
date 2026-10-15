import { Flame, Target, Zap } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { displayedStreak } from '@/lib/gamification';
import { useStats } from '@/lib/stats';
import { Badge, Card, Icon, ProgressBar, Text, colors, spacing } from '@/theme';

/** Streak, total XP and today's goal — shown at the top of the home screen. */
export function StatsBar() {
  const { stats, todayXp } = useStats();
  const streak = stats ? displayedStreak(stats) : 0;
  const goal = stats?.daily_goal_xp ?? 30;
  const reached = todayXp >= goal;

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Badge icon={Flame} label={streak} tone="streak" />
        <Badge icon={Zap} label={`${stats?.total_xp ?? 0} XP`} tone="xp" />
      </View>
      <Card padding={spacing.md}>
        <View style={styles.goalHeader}>
          <View style={styles.goalTitle}>
            <Icon icon={Target} size={18} color={reached ? colors.successShade : colors.xpShade} />
            <Text variant="bodyBold">{reached ? 'Objectif atteint !' : 'Objectif du jour'}</Text>
          </View>
          <Text variant="caption" color={colors.textSecondary}>
            {Math.min(todayXp, goal)} / {goal} XP
          </Text>
        </View>
        <ProgressBar
          progress={todayXp / goal}
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
