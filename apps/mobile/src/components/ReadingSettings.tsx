import { AudioLines, Pointer } from 'lucide-react-native';
import { useEffect } from 'react';
import { Modal, Pressable, StyleSheet, Switch, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useI18n } from '@/i18n';
import { useStats } from '@/lib/stats';
import type { PlayFromWord } from '@/lib/types';
import { Button, colors, Icon, radii, spacing, Text, themed } from '@/theme';

const GESTURES: PlayFromWord[] = ['tap', 'double_tap'];
const otherGesture = (g: PlayFromWord): PlayFromWord => (g === 'tap' ? 'double_tap' : 'tap');
const GESTURE_ROWS = [
  { action: 'translate', label: 'translateWord' },
  { action: 'play', label: 'playFromWord' },
] as const;

/** Read-along highlighting on/off, saved on the account. */
export function ReadAlongSetting() {
  const { t } = useI18n();
  const { stats, updateReadAlong } = useStats();
  return (
    <View>
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
    </View>
  );
}

/**
 * Which gesture translates a word and which plays the voice-over from it. Choosing a
 * gesture for one action gives the other gesture to the other action.
 */
export function GestureSetting() {
  const { t } = useI18n();
  const { stats, updatePlayFromWord } = useStats();
  const playGesture = stats?.play_from_word ?? 'double_tap';
  return (
    <View>
      <View style={styles.titleRow}>
        <Icon icon={Pointer} size={22} color={colors.primary} />
        <Text variant="heading">{t.profile.gestures}</Text>
      </View>
      {GESTURE_ROWS.map(({ action, label }) => (
        <View key={action} style={styles.gestureRow}>
          <Text variant="bodyBold">{t.profile[label]}</Text>
          <View style={styles.choices}>
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
                  style={styles.flex}
                  onPress={() => updatePlayFromWord(play).catch(console.warn)}
                />
              );
            })}
          </View>
        </View>
      ))}
    </View>
  );
}

/**
 * The reading settings at hand while reading (gear of the reader): the same ones as in
 * the profile. A bottom sheet in a Modal; like ConfirmSheet, no Reanimated layout
 * animation inside (on Android they can leave the buttons untouchable).
 */
export function ReadingSettingsSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { t } = useI18n();

  const offset = useSharedValue(height);
  useEffect(() => {
    if (!visible) return;
    offset.set(height);
    offset.set(withTiming(0, { duration: 300, easing: Easing.out(Easing.cubic) }));
  }, [visible, height, offset]);
  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: offset.value }] }));

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable
          style={[StyleSheet.absoluteFill, styles.backdrop]}
          onPress={onClose}
          accessibilityLabel={t.common.close}
        />
        <Animated.View
          style={[styles.sheet, { paddingBottom: insets.bottom + spacing.xl }, sheetStyle]}>
          <View style={styles.handle} />
          <Text variant="title">{t.reader.settings}</Text>
          <ReadAlongSetting />
          <View style={styles.separator} />
          <GestureSetting />
          <Button
            label={t.common.close}
            variant="secondary"
            haptic="tap"
            onPress={onClose}
            style={styles.close}
          />
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    flex: { flex: 1 },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    hint: { marginTop: spacing.xs },
    gestureRow: { gap: spacing.sm, marginTop: spacing.md },
    choices: { flexDirection: 'row', gap: spacing.sm },
    root: { flex: 1, justifyContent: 'flex-end' },
    backdrop: { backgroundColor: colors.backdrop },
    sheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: radii.xl,
      borderTopRightRadius: radii.xl,
      padding: spacing.xl,
      gap: spacing.lg,
    },
    handle: {
      alignSelf: 'center',
      width: 44,
      height: 5,
      borderRadius: radii.pill,
      backgroundColor: colors.border,
    },
    separator: { height: 2, backgroundColor: colors.border },
    close: { marginTop: spacing.sm },
  }),
);
