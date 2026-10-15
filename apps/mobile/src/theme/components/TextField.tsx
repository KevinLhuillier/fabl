import { useState } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps, type ViewStyle } from 'react-native';

import { colors } from '../colors';
import { radii, spacing, touchTarget } from '../spacing';
import { typography } from '../typography';
import { Icon, type LucideIcon } from './Icon';
import { Text } from './Text';

export type TextFieldProps = TextInputProps & {
  label?: string;
  icon?: LucideIcon;
  containerStyle?: ViewStyle;
};

/** Rounded input; border and icon turn primary on focus. */
export function TextField({ label, icon, containerStyle, style, ...rest }: TextFieldProps) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={[styles.container, containerStyle]}>
      {label ? (
        <Text variant="caption" color={colors.textSecondary}>
          {label}
        </Text>
      ) : null}
      <View style={[styles.field, focused && styles.focused]}>
        {icon ? (
          <Icon icon={icon} size={20} color={focused ? colors.primary : colors.textMuted} />
        ) : null}
        <TextInput
          placeholderTextColor={colors.textMuted}
          {...rest}
          onFocus={(e) => {
            setFocused(true);
            rest.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            rest.onBlur?.(e);
          }}
          style={[styles.input, style]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.xs },
  field: {
    minHeight: touchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.md,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  focused: { borderColor: colors.primary },
  input: { flex: 1, ...typography.bodyBold, color: colors.text, paddingVertical: spacing.md },
});
