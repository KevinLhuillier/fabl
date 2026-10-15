import type { LucideIcon } from 'lucide-react-native';
import { View, type ColorValue, type ViewStyle } from 'react-native';

import { colors } from '../colors';

export type { LucideIcon };

export type IconProps = {
  icon: LucideIcon;
  size?: number;
  /** Accepts RN ColorValue (e.g. the tab bar's tint) as well as plain strings. */
  color?: ColorValue;
};

/** Lucide icon with the app's stroke weight (chunky, rounded). */
export function Icon({ icon: Glyph, size = 20, color = colors.text }: IconProps) {
  return <Glyph size={size} color={color as string} strokeWidth={size >= 32 ? 2.25 : 2.5} />;
}

export type IconBubbleProps = IconProps & {
  /** Diameter of the circle. */
  diameter?: number;
  background?: ColorValue;
  style?: ViewStyle;
};

/** Icon centered in a soft colored circle (hero illustrations, empty states). */
export function IconBubble({
  icon,
  diameter = 88,
  color = colors.primary,
  background = colors.primarySoft,
  style,
}: IconBubbleProps) {
  return (
    <View
      style={[
        {
          width: diameter,
          height: diameter,
          borderRadius: diameter / 2,
          backgroundColor: background,
          alignItems: 'center',
          justifyContent: 'center',
          alignSelf: 'center',
        },
        style,
      ]}>
      <Icon icon={icon} size={Math.round(diameter * 0.48)} color={color} />
    </View>
  );
}
