import { router } from 'expo-router';
import {
  AudioLines,
  Flame,
  GraduationCap,
  Languages,
  LogOut,
  Target,
  Trophy,
  Zap,
  type LucideIcon,
} from 'lucide-react-native';
import { ScrollView, StyleSheet, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LANGS, LANG_NAMES, useI18n } from '@/i18n';
import { useAuth } from '@/lib/auth';
import { DAILY_GOAL_OPTIONS, displayedStreak } from '@/lib/gamification';
import { useStats } from '@/lib/stats';
import { supabase } from '@/lib/supabase';
import { useTour } from '@/lib/tour';
import { Button, Card, Icon, Text, colors, spacing } from '@/theme';

export default function Profile() {
  const { session } = useAuth();
  const { t, lang, setLang } = useI18n();
  const { stats, updateDailyGoal, updateReadAlong } = useStats();
  const { target, replay } = useTour('profile', stats !== null);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text variant="title">{t.profile.title}</Text>
        <Text color={colors.textSecondary}>{session?.user.email}</Text>

        <View style={styles.grid}>
          <Stat
            icon={Zap}
            value={stats?.total_xp ?? 0}
            label={t.profile.totalXp}
            color={colors.xpShade}
          />
          <Stat
            icon={Flame}
            value={stats ? displayedStreak(stats) : 0}
            label={t.profile.currentStreak}
            color={colors.streakShade}
          />
          <Stat
            icon={Trophy}
            value={stats?.best_streak ?? 0}
            label={t.profile.bestStreak}
            color={colors.primary}
          />
        </View>

        <View ref={target('goal')} collapsable={false}>
          <Card>
            <View style={styles.titleRow}>
              <Icon icon={Target} size={22} color={colors.xpShade} />
              <Text variant="heading">{t.profile.dailyGoal}</Text>
            </View>
            <Text color={colors.textSecondary} style={styles.hint}>
              {t.profile.dailyGoalHint}
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
        </View>

        <View ref={target('readAlong')} collapsable={false}>
          <Card>
            <View style={styles.titleRow}>
              <Icon icon={AudioLines} size={22} color={colors.primary} />
              <Text variant="heading" style={styles.flex}>
                {t.profile.readAlong}
              </Text>
              <Switch
                value={stats?.read_along ?? true}
                disabled={!stats}
                onValueChange={(v) => updateReadAlong(v).catch(console.warn)}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={colors.surface}
                accessibilityLabel={t.profile.readAlong}
              />
            </View>
            <Text color={colors.textSecondary} style={styles.hint}>
              {t.profile.readAlongHint}
            </Text>
          </Card>
        </View>

        <View ref={target('language')} collapsable={false}>
          <Card>
            <View style={styles.titleRow}>
              <Icon icon={Languages} size={22} color={colors.info} />
              <Text variant="heading">{t.profile.language}</Text>
            </View>
            <Text color={colors.textSecondary} style={styles.hint}>
              {t.profile.languageHint}
            </Text>
            <View style={styles.goals}>
              {LANGS.map((l) => (
                <Button
                  key={l}
                  label={LANG_NAMES[l]}
                  sentence
                  variant={lang === l ? 'primary' : 'secondary'}
                  haptic="tap"
                  style={styles.goal}
                  onPress={() => setLang(l).catch(console.warn)}
                />
              ))}
            </View>
          </Card>
        </View>

        <View ref={target('replay')} collapsable={false}>
          <Button
            label={t.profile.replay}
            variant="secondary"
            icon={<Icon icon={GraduationCap} size={20} color={colors.primary} />}
            onPress={() => {
              // Back to the first tab: the tour starts again from there.
              router.navigate('/');
              replay();
            }}
          />
        </View>

        <Button
          label={t.profile.signOut}
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
  flex: { flex: 1 },
  hint: { marginTop: spacing.xs, marginBottom: spacing.md },
  goals: { flexDirection: 'row', gap: spacing.sm },
  goal: { flex: 1 },
});
