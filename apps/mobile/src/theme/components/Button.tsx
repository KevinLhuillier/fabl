import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';

import { colors } from '../colors';
import { haptics } from '../haptics';
import { depth, radii, spacing, touchTarget } from '../spacing';
import { Text } from './Text';
import { usePressDepth } from './usePressDepth';

export type ButtonVariant = 'primary' | 'secondary' | 'success' | 'danger' | 'ghost';

type VariantStyle = { face: string; edge: string; text: string; border?: string };

const variants: Record<ButtonVariant, VariantStyle> = {
  primary: { face: colors.primary, edge: colors.primaryShade, text: colors.textOnColor },
  success: { face: colors.success, edge: colors.successShade, text: colors.textOnColor },
  danger: { face: colors.danger, edge: colors.dangerShade, text: colors.textOnColor },
  secondary: {
    face: colors.surface,
    edge: colors.borderShade,
    text: colors.primary,
    border: colors.border,
  },
  ghost: { face: 'transparent', edge: 'transparent', text: colors.primary },
};

export type ButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  /** Overrides the variant colors (e.g. a CEFR level color). */
  colorOverride?: { face: string; edge: string };
  icon?: ReactNode;
  disabled?: boolean;
  loading?: boolean;
  /** Use 'none' for frequent taps where a vibration would be annoying. */
  haptic?: 'press' | 'tap' | 'none';
  /** Keeps the original casing (for labels that are sentences, e.g. quiz answers). */
  sentence?: boolean;
  /** Small side padding and a one-line label, for a row of short choices (e.g. "15"). */
  compact?: boolean;
  style?: ViewStyle;
};

/** Big tactile button: 3D edge, press-down animation and haptic feedback. */
export function Button({
  label,
  onPress,
  variant = 'primary',
  colorOverride,
  icon,
  disabled,
  loading,
  haptic = 'press',
  sentence,
  compact,
  style,
}: ButtonProps) {
  const inactive = disabled || loading;
  const v = variants[variant];
  const face = inactive ? colors.disabled : (colorOverride?.face ?? v.face);
  const edge = inactive ? colors.disabledShade : (colorOverride?.edge ?? v.edge);
  const textColor = inactive ? colors.textMuted : v.text;
  const edgeHeight = variant === 'ghost' ? 0 : depth.button;
  const { faceStyle, pressIn, pressOut } = usePressDepth(edgeHeight);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      disabled={inactive}
      onPressIn={pressIn}
      onPressOut={pressOut}
      onPress={() => {
        if (haptic !== 'none') haptics[haptic]();
        onPress?.();
      }}
      style={[{ paddingBottom: edgeHeight }, style]}>
      <View style={[styles.edge, { top: edgeHeight, backgroundColor: edge }]} />
      <Animated.View
        style={[
          styles.face,
          compact && styles.compact,
          { backgroundColor: face },
          v.border && !inactive && { borderWidth: 2, borderColor: v.border },
          faceStyle,
        ]}>
        {loading ? (
          <ActivityIndicator color={textColor} />
        ) : (
          <>
            {icon}
            <Text
              variant={sentence ? 'bodyBold' : 'button'}
              color={textColor}
              align="center"
              numberOfLines={compact ? 1 : undefined}
              style={styles.label}>
              {label}
            </Text>
          </>
        )}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  edge: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: radii.md,
  },
  face: {
    minHeight: touchTarget,
    borderRadius: radii.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  compact: { paddingHorizontal: spacing.sm },
  label: { flexShrink: 1 },
});
