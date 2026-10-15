import { useEffect, useState } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { colors } from '../colors';
import { springs } from '../motion';
import { radii } from '../spacing';

export type ProgressBarProps = {
  /** 0 → 1, clamped. */
  progress: number;
  color?: string;
  trackColor?: string;
  height?: number;
  style?: ViewStyle;
};

/** Rounded progress bar with a springy fill and a glossy highlight. */
export function ProgressBar({
  progress,
  color = colors.success,
  trackColor = colors.border,
  height = 16,
  style,
}: ProgressBarProps) {
  const [trackWidth, setTrackWidth] = useState(0);
  const value = useSharedValue(0);
  const clamped = Math.min(1, Math.max(0, progress));

  useEffect(() => {
    value.set(withSpring(clamped, springs.gentle));
  }, [clamped, value]);

  // Animate a pixel width (measured on layout) rather than a percentage string.
  const fillStyle = useAnimatedStyle(() => ({
    // Keep a visible stub when progress > 0 so the rounded end never collapses.
    width: value.value > 0 ? Math.max(height, value.value * trackWidth) : 0,
  }));

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
      onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
      style={[styles.track, { height, backgroundColor: trackColor }, style]}>
      <Animated.View style={[styles.fill, { backgroundColor: color }, fillStyle]}>
        <View style={[styles.highlight, { height: height / 4, top: height / 5 }]} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: '100%',
    borderRadius: radii.pill,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: radii.pill,
  },
  highlight: {
    position: 'absolute',
    left: 8,
    right: 8,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
});
