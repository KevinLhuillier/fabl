import { useRouter } from 'expo-router';
import {
  CloudUpload,
  Crown,
  Flame,
  GraduationCap,
  Languages,
  LogOut,
  Target,
  Trophy,
  Clock,
  UserX,
  type LucideIcon,
} from 'lucide-react-native';
import { useState } from 'react';
import { Linking, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ConfirmSheet } from '@/components/ConfirmSheet';
import { GestureSetting, ReadAlongSetting } from '@/components/ReadingSettings';
import { ReminderSetting } from '@/components/ReminderSettings';
import { LANGS, LANG_NAMES, useI18n } from '@/i18n';
import { deleteAccount, useAuth } from '@/lib/auth';
import { formatDuration } from '@/lib/labels';
import { DAILY_GOAL_OPTIONS, displayedStreak } from '@/lib/gamification';
import { isGuest } from '@/lib/guest';
import { usePremium } from '@/lib/premium';
import { REMINDERS_SUPPORTED } from '@/lib/reminders';
import { useStats } from '@/lib/stats';
import { supabase } from '@/lib/supabase';
import { Button, Card, colors, Icon, spacing, Text, themed } from '@/theme';

export default function Profile() {
  const router = useRouter();
  const { session } = useAuth();
  const { t, lang, setLang } = useI18n();
  const { stats, updateDailyGoal } = useStats();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(false);
  const [confirmGuestSignOut, setConfirmGuestSignOut] = useState(false);
  const guest = isGuest(session);

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
        {guest ? (
          <Card tint={{ face: colors.infoSoft, edge: colors.info }}>
            <View style={styles.titleRow}>
              <Icon icon={CloudUpload} size={22} color={colors.infoShade} />
              <Text variant="heading">{t.profile.saveTitle}</Text>
            </View>
            <Text color={colors.textSecondary} style={styles.hint}>
              {t.profile.saveHint}
            </Text>
            <Button label={t.profile.saveButton} onPress={() => router.push('/save-account')} />
          </Card>
        ) : (
          <Text color={colors.textSecondary}>{session?.user.email}</Text>
        )}

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

        <PremiumCard />

        <View>
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

        <View>
          <Card>
            <ReadAlongSetting />
          </Card>
        </View>

        <Card>
          <GestureSetting />
        </Card>

        {REMINDERS_SUPPORTED ? (
          <Card>
            <ReminderSetting />
          </Card>
        ) : null}

        <View>
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

        <View>
          <Button
            label={t.profile.replay}
            variant="secondary"
            icon={<Icon icon={GraduationCap} size={20} color={colors.primary} />}
            onPress={() => router.push('/intro')}
          />
        </View>

        <Button
          label={t.profile.signOut}
          variant="danger"
          icon={<Icon icon={LogOut} size={20} color={colors.textOnColor} />}
          // A guest can't come back once signed out: warn first.
          onPress={() => (guest ? setConfirmGuestSignOut(true) : supabase.auth.signOut())}
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
      <ConfirmSheet
        visible={confirmGuestSignOut}
        icon={LogOut}
        tone="danger"
        title={t.profile.guestSignOutTitle}
        message={t.profile.guestSignOutMessage}
        confirmLabel={t.profile.guestSignOutConfirm}
        onConfirm={() => {
          setConfirmGuestSignOut(false);
          supabase.auth.signOut().catch(console.warn);
        }}
        onCancel={() => setConfirmGuestSignOut(false)}
      />
    </SafeAreaView>
  );
}

/** Subscription status: renewal date and store link, or the way to premium. */
function PremiumCard() {
  const router = useRouter();
  const { t } = useI18n();
  const p = t.premium;
  const { premium, subscription, managementUrl } = usePremium();

  if (premium) {
    const expires = subscription?.expires_at ? p.date(new Date(subscription.expires_at)) : null;
    return (
      <Card tint={{ face: colors.xpSoft, edge: colors.xp }}>
        <View style={styles.titleRow}>
          <Icon icon={Crown} size={22} color={colors.xpShade} />
          <Text variant="heading">{p.activeTitle}</Text>
        </View>
        {expires ? (
          <Text color={colors.textSecondary} style={styles.hint}>
            {subscription?.will_renew === false ? p.endsOn(expires) : p.renewsOn(expires)}
          </Text>
        ) : null}
        {subscription?.billing_issue ? (
          <Text variant="bodyBold" color={colors.danger} style={styles.hint}>
            {p.billingIssue}
          </Text>
        ) : null}
        <Button
          label={p.manage}
          variant="secondary"
          onPress={() => Linking.openURL(managementUrl)}
          style={styles.premiumButton}
        />
      </Card>
    );
  }

  return (
    <Card tint={{ face: colors.xpSoft, edge: colors.xp }}>
      <View style={styles.titleRow}>
        <Icon icon={Crown} size={22} color={colors.xpShade} />
        <Text variant="heading">{p.freePlan}</Text>
      </View>
      <Text color={colors.textSecondary} style={styles.hint}>
        {p.subtitle}
      </Text>
      <Button label={p.upgrade} variant="success" onPress={() => router.push('/paywall')} />
    </Card>
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

const styles = themed(() =>
  StyleSheet.create({
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
    premiumButton: { marginTop: spacing.xs },
  }),
);
