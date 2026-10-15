import { Flame, LogOut, Target, Trophy, Zap, type LucideIcon } from 'lucide-react-native';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/lib/auth';
import { DAILY_GOAL_OPTIONS, displayedStreak } from '@/lib/gamification';
import { useStats } from '@/lib/stats';
import { supabase } from '@/lib/supabase';
import { Button, Card, Icon, Text, colors, spacing } from '@/theme';

export default function Profile() {
  const { session } = useAuth();
  const { stats, updateDailyGoal } = useStats();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text variant="title">Profil</Text>
        <Text color={colors.textSecondary}>{session?.user.email}</Text>

        <View style={styles.grid}>
          <Stat
            icon={Zap}
            value={stats?.total_xp ?? 0}
            label="XP au total"
            color={colors.xpShade}
          />
          <Stat
            icon={Flame}
            value={stats ? displayedStreak(stats) : 0}
            label="Série actuelle"
            color={colors.streakShade}
          />
          <Stat
            icon={Trophy}
            value={stats?.best_streak ?? 0}
            label="Meilleure série"
            color={colors.primary}
          />
        </View>

        <Card>
          <View style={styles.titleRow}>
            <Icon icon={Target} size={22} color={colors.xpShade} />
            <Text variant="heading">Objectif quotidien</Text>
          </View>
          <Text color={colors.textSecondary} style={styles.hint}>
            XP à gagner chaque jour.
          </Text>
          <View style={styles.goals}>
            {DAILY_GOAL_OPTIONS.map((goal) => (
              <Button
                key={goal}
                label={`${goal}`}
                variant={stats?.daily_goal_xp === goal ? 'primary' : 'secondary'}
                haptic="tap"
                style={styles.goal}
                onPress={() => updateDailyGoal(goal).catch(console.warn)}
              />
            ))}
          </View>
        </Card>

        <Button
          label="Se déconnecter"
          variant="danger"
          icon={<Icon icon={LogOut} size={20} color={colors.textOnColor} />}
          onPress={() => supabase.auth.signOut()}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({
  icon,
  value,
  label,
  color,
}: {
  icon: LucideIcon;
  value: number;
  label: string;
  color: string;
}) {
  return (
    <Card style={styles.stat} padding={spacing.md}>
      <Icon icon={icon} size={22} color={color} />
      <Text variant="title" color={color}>
        {value}
      </Text>
      {/* Always one line: shrinks slightly on narrow screens instead of wrapping. */}
      <Text
        variant="caption"
        color={colors.textSecondary}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.75}>
        {label}
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.xl, gap: spacing.lg },
  grid: { flexDirection: 'row', gap: spacing.sm },
  stat: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  hint: { marginTop: spacing.xs, marginBottom: spacing.md },
  goals: { flexDirection: 'row', gap: spacing.sm },
  goal: { flex: 1 },
});
