import { Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { colors } from '../colors';
import { typography, type TypographyVariant } from '../typography';

export type TextProps = RNTextProps & {
  variant?: TypographyVariant;
  color?: string;
  align?: 'left' | 'center' | 'right';
};

/** Typed text: always use this instead of RN `Text` so the fonts stay consistent. */
export function Text({ variant = 'body', color = colors.text, align, style, ...rest }: TextProps) {
  return <RNText style={[typography[variant], { color, textAlign: align }, style]} {...rest} />;
}
