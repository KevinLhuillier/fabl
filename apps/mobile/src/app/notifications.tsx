import { BellRing } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { HourChoice } from '@/components/ReminderSettings';
import { useI18n } from '@/i18n';
import { useReminders } from '@/lib/reminders';
import { Button, Card, colors, enter, IconBubble, spacing, Text, themed } from '@/theme';

/**
 * Asked once, after the onboarding (and once to the accounts created before): daily
 * reminders, then the phone's permission prompt. Either answer lets the guard in `_layout`
 * open the app; the profile changes it later.
 */
export default function NotificationsScreen() {
  const { t } = useI18n();
  const r = t.reminders;
  const { prefs, enable, skip } = useReminders();
  const [hour, setHour] = useState(prefs.hour);
  const [asking, setAsking] = useState(false);

  async function accept() {
    setAsking(true);
    try {
      // Refused in the phone's prompt: saved as asked, the app opens all the same.
      await enable(hour);
    } catch (e) {
      console.warn('reminders', e);
      skip();
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Animated.View entering={enter.up()} style={styles.hero}>
          <IconBubble icon={BellRing} color={colors.xpShade} background={colors.xpSoft} />
          <Text variant="title" align="center">
            {r.promptTitle}
          </Text>
          <Text align="center" color={colors.textSecondary}>
            {r.promptText}
          </Text>
        </Animated.View>

        <Animated.View entering={enter.up(100)}>
          <Card>
            <Text variant="heading">{r.promptHour}</Text>
            <HourChoice hour={hour} onChange={setHour} />
          </Card>
        </Animated.View>

        <View style={styles.actions}>
          <Button label={r.enable} loading={asking} onPress={accept} />
          <Button
            label={r.later}
            variant="ghost"
            haptic="tap"
            sentence
            disabled={asking}
            onPress={skip}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    content: { flexGrow: 1, justifyContent: 'center', padding: spacing.xl, gap: spacing.xl },
    hero: { alignItems: 'center', gap: spacing.sm },
    actions: { gap: spacing.sm },
  }),
);
