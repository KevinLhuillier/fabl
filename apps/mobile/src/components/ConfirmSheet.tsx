import type { LucideIcon } from 'lucide-react-native';
import { useEffect } from 'react';
import { Modal, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useI18n } from '@/i18n';
import { Button, IconBubble, Text, colors, radii, spacing } from '@/theme';

type Props = {
  visible: boolean;
  icon: LucideIcon;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  /** "danger" for destructive actions (red confirm button). */
  tone?: 'danger' | 'primary';
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * In-app confirmation dialog (replaces the system Alert): a bottom sheet in the
 * app's style, rendered in a Modal so it also covers the tab bar.
 *
 * No Reanimated layout animations (`entering`) in here: inside a Modal on
 * Android they can leave the buttons visible but untouchable. The backdrop
 * fades with the Modal itself, the sheet slides up with an animated style.
 */
export function ConfirmSheet({
  visible,
  icon,
  title,
  message,
  confirmLabel,
  cancelLabel,
  tone = 'primary',
  onConfirm,
  onCancel,
}: Props) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { t } = useI18n();
  const cancel = cancelLabel ?? t.common.cancel;
  const danger = tone === 'danger';

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
      onRequestClose={onCancel}>
      <View style={styles.root}>
        <Pressable
          style={[StyleSheet.absoluteFill, styles.backdrop]}
          onPress={onCancel}
          accessibilityLabel={cancel}
        />
        <Animated.View
          style={[styles.sheet, { paddingBottom: insets.bottom + spacing.xl }, sheetStyle]}>
          <View style={styles.handle} />
          <IconBubble
            icon={icon}
            diameter={72}
            color={danger ? colors.dangerShade : colors.primary}
            background={danger ? colors.accentSoft : colors.primarySoft}
          />
          <Text variant="title" align="center">
            {title}
          </Text>
          <Text align="center" color={colors.textSecondary}>
            {message}
          </Text>
          <View style={styles.actions}>
            <Button
              label={confirmLabel}
              variant={danger ? 'danger' : 'primary'}
              onPress={onConfirm}
            />
            <Button label={cancel} variant="secondary" haptic="tap" onPress={onCancel} />
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { backgroundColor: 'rgba(37,34,58,0.35)' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    padding: spacing.xl,
    gap: spacing.md,
  },
  handle: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: radii.pill,
    backgroundColor: colors.border,
    marginBottom: spacing.xs,
  },
  actions: { gap: spacing.md, marginTop: spacing.sm },
});
