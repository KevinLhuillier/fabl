import { router } from 'expo-router';
import {
  AudioLines,
  Flame,
  GraduationCap,
  Languages,
  LogOut,
  Pointer,
  Target,
  Trophy,
  Clock,
  UserX,
  type LucideIcon,
} from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, StyleSheet, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ConfirmSheet } from '@/components/ConfirmSheet';
import { LANGS, LANG_NAMES, useI18n } from '@/i18n';
import { deleteAccount, useAuth } from '@/lib/auth';
import { formatDuration } from '@/lib/labels';
import { DAILY_GOAL_OPTIONS, displayedStreak } from '@/lib/gamification';
import { useStats } from '@/lib/stats';
import { supabase } from '@/lib/supabase';
import { useTour } from '@/lib/tour';
import type { PlayFromWord } from '@/lib/types';
import { Button, Card, Icon, Text, colors, spacing } from '@/theme';

const GESTURES: PlayFromWord[] = ['tap', 'double_tap'];
const otherGesture = (g: PlayFromWord): PlayFromWord => (g === 'tap' ? 'double_tap' : 'tap');
const GESTURE_ROWS = [
  { action: 'translate', label: 'translateWord' },
  { action: 'play', label: 'playFromWord' },
] as const;

export default function Profile() {
  const { session } = useAuth();
  const { t, lang, setLang } = useI18n();
  const { stats, updateDailyGoal, updateReadAlong, updatePlayFromWord } = useStats();
  const { target, replay } = useTour('profile', stats !== null);
  const playGesture = stats?.play_from_word ?? 'double_tap';
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(false);

  const removeAccount = async () => {
    setConfirmDelete(false);
    setDeleting(true);
    setDeleteError(false);
    try {
      // Signed out on success: the auth guard leaves for the sign-in screen.
      await deleteAccount();
    } catch (e) {
      console.warn(e);
      setDeleteError(true);
      setDeleting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text variant="title">{t.profile.title}</Text>
        {stats?.username ? (
          <Text variant="heading" color={colors.primary}>
            @{stats.username}
          </Text>
        ) : null}
        <Text color={colors.textSecondary}>{session?.user.email}</Text>

        <View style={styles.grid}>
          <Stat
            icon={Clock}
            value={formatDuration(stats?.total_seconds ?? 0)}
            label={t.profile.totalTime}
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
                  variant={stats?.daily_goal_minutes === goal ? 'primary' : 'secondary'}
                  haptic="tap"
                  compact
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

        <Card>
          <View style={styles.titleRow}>
            <Icon icon={Pointer} size={22} color={colors.primary} />
            <Text variant="heading">{t.profile.gestures}</Text>
          </View>
          {/* Choosing a gesture for one action gives the other gesture to the other action. */}
          {GESTURE_ROWS.map(({ action, label }) => (
            <View key={action} style={styles.gestureRow}>
              <Text variant="bodyBold">{t.profile[label]}</Text>
              <View style={styles.goals}>
                {GESTURES.map((gesture) => {
                  const play = action === 'play' ? gesture : otherGesture(gesture);
                  return (
                    <Button
                      key={gesture}
                      label={t.profile.gestureNames[gesture]}
                      sentence
                      compact
                      variant={playGesture === play ? 'primary' : 'secondary'}
                      haptic="tap"
                      disabled={!stats}
                      style={styles.goal}
                      onPress={() => updatePlayFromWord(play).catch(console.warn)}
                    />
                  );
                })}
              </View>
            </View>
          ))}
        </Card>

        <View ref={target('language')} collapsable={false}>
          <Card>
            <View style={styles.titleRow}>
              <Icon icon={Languages} size={22} color={colors.info} />
              <Text variant="heading">{t.profile.language}</Text>
            </View>
            <Text color={colors.textSecondary} style={styles.hint}>
              {t.profile.languageHint}
            </Text>
            <View style={styles.langs}>
              {LANGS.map((l) => (
                <Button
                  key={l}
                  label={LANG_NAMES[l]}
                  sentence
                  variant={lang === l ? 'primary' : 'secondary'}
                  haptic="tap"
                  style={styles.lang}
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

        <Button
          label={t.profile.deleteAccount}
          variant="ghost"
          haptic="tap"
          loading={deleting}
          disabled={deleting}
          onPress={() => setConfirmDelete(true)}
        />
        {deleteError ? (
          <Text align="center" color={colors.danger}>
            {t.profile.deleteError}
          </Text>
        ) : null}
      </ScrollView>
      <ConfirmSheet
        visible={confirmDelete}
        icon={UserX}
        tone="danger"
        title={t.profile.deleteTitle}
        message={t.profile.deleteMessage}
        confirmLabel={t.profile.deleteConfirm}
        onConfirm={removeAccount}
        onCancel={() => setConfirmDelete(false)}
      />
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
  value: number | string;
  label: string;
  color: string;
}) {
  return (
    <Card style={styles.stat} padding={spacing.md}>
      <Icon icon={icon} size={22} color={color} />
      {/* One line: a long value ("< 1 min", "12 h 05") shrinks instead of wrapping. */}
      <Text
        variant="title"
        color={color}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.6}>
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
  // Two per row: the names do not fit five abreast.
  langs: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  lang: { flexGrow: 1, flexBasis: '40%' },
  gestureRow: { gap: spacing.sm, marginTop: spacing.sm },
});
