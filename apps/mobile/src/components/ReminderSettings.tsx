import * as Notifications from 'expo-notifications';
import { Bell } from 'lucide-react-native';
import { useState } from 'react';
import { Linking, StyleSheet, Switch, View } from 'react-native';

import { useI18n } from '@/i18n';
import { REMINDER_HOURS, useReminders } from '@/lib/reminders';
import { Button, colors, Icon, spacing, Text, TextField, themed } from '@/theme';

/** The hours offered for the daily reminder. */
export function HourChoice({ hour, onChange }: { hour: number; onChange: (hour: number) => void }) {
  const { t } = useI18n();
  return (
    <View style={styles.hours}>
      {REMINDER_HOURS.map((h) => (
        <Button
          key={h}
          label={t.reminders.hour(h)}
          sentence
          compact
          variant={hour === h ? 'primary' : 'secondary'}
          haptic="tap"
          style={styles.hour}
          onPress={() => onChange(h)}
        />
      ))}
    </View>
  );
}

/** Profile: daily reminders on/off and their hour. */
export function ReminderSetting() {
  const { t } = useI18n();
  const { prefs, permission, enable, disable, setHour } = useReminders();
  const [asking, setAsking] = useState(false);
  const on = prefs.enabled && permission === 'granted';

  const toggle = async (value: boolean) => {
    if (!value) return disable();
    setAsking(true);
    try {
      await enable();
    } catch (e) {
      console.warn('reminders', e);
    } finally {
      setAsking(false);
    }
  };

  return (
    <View>
      <View style={styles.titleRow}>
        <Icon icon={Bell} size={22} color={colors.xpShade} />
        <Text variant="heading" style={styles.flex}>
          {t.reminders.title}
        </Text>
        <Switch
          value={on}
          disabled={asking}
          onValueChange={toggle}
          trackColor={{ false: colors.border, true: colors.primary }}
          thumbColor={colors.surface}
          accessibilityLabel={t.reminders.title}
        />
      </View>
      <Text color={colors.textSecondary} style={styles.hint}>
        {t.reminders.hint}
      </Text>
      {permission === 'denied' ? (
        <View style={styles.denied}>
          <Text color={colors.danger}>{t.reminders.denied}</Text>
          <Button
            label={t.reminders.openSettings}
            variant="secondary"
            compact
            onPress={() => Linking.openSettings()}
          />
        </View>
      ) : on ? (
        <>
          <HourChoice hour={prefs.hour} onChange={setHour} />
          {__DEV__ ? <ReminderTestTime /> : null}
        </>
      ) : null}
    </View>
  );
}

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Development builds only (never in the store app): any time "HH:MM" for the reminders,
 * and the list of what is scheduled, to test the notifications without waiting.
 */
function ReminderTestTime() {
  const { prefs, setTime } = useReminders();
  const [value, setValue] = useState(`${pad(prefs.hour)}:${pad(prefs.minute ?? 0)}`);
  const [scheduled, setScheduled] = useState<string[] | null>(null);
  const match = /^(\d{1,2})[:h](\d{2})$/.exec(value.trim());
  const valid = !!match && Number(match[1]) < 24 && Number(match[2]) < 60;

  const refresh = async () => {
    const all = await Notifications.getAllScheduledNotificationsAsync();
    setScheduled(
      all
        .map((n) => {
          const trigger = n.trigger as { value?: number; date?: number } | null;
          const at = trigger?.value ?? trigger?.date;
          return { at: at ? new Date(at) : null, title: n.content.title ?? '' };
        })
        .sort((a, b) => (a.at?.getTime() ?? 0) - (b.at?.getTime() ?? 0))
        .map(
          ({ at, title }) =>
            `${at ? `${pad(at.getDate())}/${pad(at.getMonth() + 1)} ${pad(at.getHours())}:${pad(at.getMinutes())}` : '?'}  ${title}`,
        ),
    );
  };

  return (
    <View style={styles.test}>
      <Text variant="caption" color={colors.textSecondary}>
        TEST (dev uniquement) : heure exacte des rappels
      </Text>
      <View style={styles.testRow}>
        <TextField
          value={value}
          onChangeText={setValue}
          placeholder="HH:MM"
          keyboardType="numbers-and-punctuation"
          containerStyle={styles.flex}
        />
        <Button
          label="Appliquer"
          sentence
          compact
          disabled={!valid}
          onPress={() => match && setTime(Number(match[1]), Number(match[2]))}
        />
      </View>
      <Button
        label="Voir les rappels programmés"
        variant="secondary"
        sentence
        compact
        onPress={() => refresh().catch(console.warn)}
      />
      {scheduled ? (
        <Text variant="caption" color={colors.textSecondary}>
          {scheduled.length ? scheduled.join('\n') : 'Aucun rappel programmé'}
        </Text>
      ) : null}
    </View>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    flex: { flex: 1 },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    hint: { marginTop: spacing.xs },
    // Three per row.
    hours: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
    hour: { flexGrow: 1, flexBasis: '28%' },
    denied: { gap: spacing.sm, marginTop: spacing.md },
    test: { gap: spacing.sm, marginTop: spacing.lg },
    testRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  }),
);
