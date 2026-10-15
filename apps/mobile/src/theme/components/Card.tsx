import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';

import { colors } from '../colors';
import { haptics } from '../haptics';
import { depth, radii, spacing } from '../spacing';
import { usePressDepth } from './usePressDepth';

export type CardProps = {
  children: ReactNode;
  /** When set, the card becomes pressable with the same 3D effect as buttons. */
  onPress?: () => void;
  tint?: { face: string; edge: string };
  padding?: number;
  style?: ViewStyle;
};

/** Rounded surface with a soft 3D edge. */
export function Card({ children, onPress, tint, padding = spacing.lg, style }: CardProps) {
  const face = tint?.face ?? colors.surface;
  const edge = tint?.edge ?? colors.border;
  const { faceStyle, pressIn, pressOut } = usePressDepth(onPress ? depth.card : 0);

  const content = (
    <>
      <View style={[styles.edge, { top: depth.card, backgroundColor: edge }]} />
      <Animated.View
        style={[styles.face, { backgroundColor: face, borderColor: edge, padding }, faceStyle]}>
        {children}
      </Animated.View>
    </>
  );

  if (!onPress) {
    return <View style={[{ paddingBottom: depth.card }, style]}>{content}</View>;
  }

  return (
    <Pressable
      accessibilityRole="button"
      onPressIn={pressIn}
      onPressOut={pressOut}
      onPress={() => {
        haptics.tap();
        onPress();
      }}
      style={[{ paddingBottom: depth.card }, style]}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  edge: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: radii.lg,
  },
  face: {
    borderRadius: radii.lg,
    borderWidth: 2,
  },
});
