import { Check, Target } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useI18n } from '@/i18n';
import { DAILY_GOAL_OPTIONS, DEFAULT_DAILY_GOAL } from '@/lib/gamification';
import { useStats } from '@/lib/stats';
import { Button, Card, Icon, IconBubble, Text, colors, enter, spacing } from '@/theme';

/**
 * First sign-in, right after the language: the user picks how many minutes to
 * read or review each day. Saving it on the account lets the guard in `_layout`
 * open the app.
 */
export default function DailyGoalScreen() {
  const { t } = useI18n();
  const { updateDailyGoal } = useStats();
  const [selected, setSelected] = useState<number>(DEFAULT_DAILY_GOAL);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setSaving(true);
    setError(null);
    try {
      await updateDailyGoal(selected);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Animated.View entering={enter.up()} style={styles.hero}>
          <IconBubble icon={Target} />
          <Text variant="title" align="center">
            {t.dailyGoal.title}
          </Text>
          <Text align="center" color={colors.textSecondary}>
            {t.dailyGoal.hint}
          </Text>
        </Animated.View>

        <View style={styles.options}>
          {DAILY_GOAL_OPTIONS.map((minutes, i) => {
            const active = minutes === selected;
            const color = active ? colors.primary : colors.text;
            return (
              <Animated.View key={minutes} entering={enter.up(100 + i * 50)}>
                <Card
                  onPress={() => setSelected(minutes)}
                  tint={active ? { face: colors.primarySoft, edge: colors.primary } : undefined}>
                  <View style={styles.option}>
                    <Text variant="heading" color={color} style={styles.flex}>
                      {t.dailyGoal.levels[minutes]}
                    </Text>
                    <Text color={active ? colors.primary : colors.textSecondary}>
                      {`${t.common.minutes(minutes)} ${t.dailyGoal.perDay}`}
                    </Text>
                    <View style={styles.check}>
                      {active ? <Icon icon={Check} size={22} color={colors.primary} /> : null}
                    </View>
                  </View>
                </Card>
              </Animated.View>
            );
          })}
        </View>

        {error ? <Text color={colors.danger}>{error}</Text> : null}
        <Button label={t.common.continue} loading={saving} onPress={confirm} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, justifyContent: 'center', padding: spacing.xl, gap: spacing.xl },
  hero: { gap: spacing.sm },
  options: { gap: spacing.md },
  option: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 32 },
  flex: { flex: 1 },
  // Same width with or without the check mark, so the minutes stay aligned.
  check: { width: 22 },
});
