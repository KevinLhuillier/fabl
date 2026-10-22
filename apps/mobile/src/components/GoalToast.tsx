import { Target } from 'lucide-react-native';
import { useEffect, useState, type ReactNode } from 'react';
import { AppState, Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FullWindowOverlay } from 'react-native-screens';

import { useI18n } from '@/i18n';
import { displayedStreak } from '@/lib/gamification';
import { useStats } from '@/lib/stats';
import { Card, Icon, Text, colors, enter, exit, spacing } from '@/theme';

/** How long the message stays on screen. */
const VISIBLE_MS = 4000;

/**
 * Message at the top of the screen when today's goal is reached, whatever the
 * screen (reader, review…). Hides itself after a few seconds, or on tap.
 */
export function GoalToast() {
  const { stats, todaySeconds, goalReachedAt, dismissGoalReached } = useStats();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const appActive = useAppActive();

  // The goal can be crossed by the time sent when leaving the app: the
  // countdown only starts once the app is back, so the message is seen.
  useEffect(() => {
    if (goalReachedAt === null || !appActive) return;
    const id = setTimeout(dismissGoalReached, VISIBLE_MS);
    return () => clearTimeout(id);
  }, [goalReachedAt, appActive, dismissGoalReached]);

  const streak = stats ? displayedStreak(stats) : 0;

  return (
    <Overlay>
      <View style={[styles.wrap, { top: insets.top + spacing.sm }]} pointerEvents="box-none">
        {/* The wrapper stays mounted so the message can fade out. */}
        {goalReachedAt !== null ? (
          <Animated.View key={goalReachedAt} entering={enter.up()} exiting={exit.fade()}>
            <Pressable
              onPress={dismissGoalReached}
              accessibilityRole="alert"
              accessibilityLabel={t.stats.goalToastTitle}>
              <Card tint={{ face: colors.successSoft, edge: colors.success }} padding={spacing.md}>
                <View style={styles.row}>
                  <Icon icon={Target} size={28} color={colors.successShade} />
                  <View style={styles.flex}>
                    <Text variant="bodyBold" color={colors.successShade}>
                      {t.stats.goalToastTitle}
                    </Text>
                    <Text variant="caption" color={colors.textSecondary}>
                      {t.stats.goalToastText(Math.floor(todaySeconds / 60), streak)}
                    </Text>
                  </View>
                </View>
              </Card>
            </Pressable>
          </Animated.View>
        ) : null}
      </View>
    </Overlay>
  );
}

/**
 * Above every screen. On iOS, native modals (the review) are drawn in their own
 * layer, over the app's views: only a full-window overlay stays on top. On
 * Android, a high elevation keeps the message over the native screens.
 */
function Overlay({ children }: { children: ReactNode }) {
  if (Platform.OS === 'ios') return <FullWindowOverlay>{children}</FullWindowOverlay>;
  return (
    <View style={styles.androidLayer} pointerEvents="box-none">
      {children}
    </View>
  );
}

function useAppActive() {
  const [active, setActive] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => setActive(state === 'active'));
    return () => sub.remove();
  }, []);
  return active;
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: spacing.lg, right: spacing.lg },
  androidLayer: { ...StyleSheet.absoluteFill, zIndex: 1000, elevation: 1000 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1 },
});
