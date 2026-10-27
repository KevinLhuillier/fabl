import { StyleSheet, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';

import { brandGradient, palette } from '@/theme';

/**
 * The app icon's background: a diagonal violet gradient with a soft light at the top left.
 * Fills its parent (absolute); give the parent rounded corners + overflow hidden to clip it.
 */
export function BrandGradient({ style }: { style?: ViewStyle }) {
  return (
    <Svg style={[StyleSheet.absoluteFill, style]}>
      <Defs>
        <LinearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          {brandGradient.map((c, i) => (
            <Stop key={c} offset={i / (brandGradient.length - 1)} stopColor={c} />
          ))}
        </LinearGradient>
        <RadialGradient id="glow" cx="0.3" cy="0.22" r="0.6">
          <Stop offset="0" stopColor={palette.white} stopOpacity={0.2} />
          <Stop offset="1" stopColor={palette.white} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#bg)" />
      <Rect width="100%" height="100%" fill="url(#glow)" />
    </Svg>
  );
}
