import { useEffect } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { colors } from '../colors';
import { enter } from '../motion';
import { spacing } from '../spacing';
import { Icon, type LucideIcon } from './Icon';
import { Text } from './Text';

const DOT_COLORS = [colors.primary, colors.accent, colors.xp];
const DOT_SIZE = 10;
/** One bounce of the dots; each one starts a bit after the previous. */
const BOUNCE_MS = 320;
const STAGGER_MS = 140;
const BUBBLE = 96;

export type LoaderProps = {
  /** Glyph in the bubble; without it, only the bouncing dots (inline loader). */
  icon?: LucideIcon;
  /** Shown under the dots when loading takes a moment (not on quick loads). */
  message?: string;
  color?: string;
  /** The three dots, e.g. light ones on a colored background. */
  dotColors?: readonly string[];
  background?: string;
  style?: ViewStyle;
};

/**
 * Loading state: a "breathing" icon bubble with a ripple halo, three bouncing dots and
 * a message. Static when the system asks for reduced motion.
 */
export function Loader({
  icon,
  message,
  color = colors.primary,
  background = colors.primarySoft,
  dotColors = DOT_COLORS,
  style,
}: LoaderProps) {
  const reduceMotion = useReducedMotion();

  return (
    <Animated.View
      entering={enter.fade(120)}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={message}
      accessibilityState={{ busy: true }}
      style={[styles.box, style]}>
      {icon ? (
        <Bubble icon={icon} color={color} background={background} animate={!reduceMotion} />
      ) : null}
      <View style={styles.dots}>
        {dotColors.map((c, i) => (
          <Dot key={i} color={c} index={i} animate={!reduceMotion} />
        ))}
      </View>
      {message ? (
        <Animated.View entering={enter.up(600)}>
          <Text variant="bodyBold" align="center" color={colors.textSecondary}>
            {message}
          </Text>
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

/** Repeats `make` forever once mounted (nothing when motion is reduced). */
function useLoop(value: SharedValue<number>, animate: boolean, make: () => number) {
  useEffect(() => {
    if (animate) value.set(make());
    // `make` builds the same animation on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animate, value]);
}

const ease = Easing.inOut(Easing.quad);

function Bubble({
  icon,
  color,
  background,
  animate,
}: {
  icon: LucideIcon;
  color: string;
  background: string;
  animate: boolean;
}) {
  const breath = useSharedValue(0);
  const ripple = useSharedValue(0);
  useLoop(breath, animate, () =>
    withRepeat(withTiming(1, { duration: 1100, easing: ease }), -1, true),
  );
  useLoop(ripple, animate, () =>
    withRepeat(withTiming(1, { duration: 1600, easing: Easing.out(Easing.cubic) }), -1),
  );

  const bubbleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + breath.value * 0.06 }, { translateY: -breath.value * 3 }],
  }));
  const haloStyle = useAnimatedStyle(() => ({
    opacity: animate ? 0.45 * (1 - ripple.value) : 0,
    transform: [{ scale: 1 + ripple.value * 0.6 }],
  }));

  return (
    <View style={styles.bubbleBox}>
      <Animated.View style={[styles.circle, { backgroundColor: background }, haloStyle]} />
      <Animated.View
        style={[styles.circle, styles.bubble, { backgroundColor: background }, bubbleStyle]}>
        <Icon icon={icon} size={Math.round(BUBBLE * 0.46)} color={color} />
      </Animated.View>
    </View>
  );
}

function Dot({ color, index, animate }: { color: string; index: number; animate: boolean }) {
  const y = useSharedValue(0);
  useLoop(y, animate, () =>
    withDelay(
      index * STAGGER_MS,
      withRepeat(
        withSequence(
          withTiming(-DOT_SIZE, { duration: BOUNCE_MS, easing: Easing.out(Easing.quad) }),
          withTiming(0, { duration: BOUNCE_MS, easing: Easing.in(Easing.quad) }),
          // Rest so the three dots bounce as a wave, then pause.
          withTiming(0, { duration: BOUNCE_MS }),
        ),
        -1,
      ),
    ),
  );
  const dotStyle = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  return <Animated.View style={[styles.dot, { backgroundColor: color }, dotStyle]} />;
}

const styles = StyleSheet.create({
  box: { alignItems: 'center', justifyContent: 'center', gap: spacing.lg, padding: spacing.xl },
  bubbleBox: { width: BUBBLE, height: BUBBLE, marginBottom: spacing.sm },
  circle: {
    position: 'absolute',
    inset: 0,
    borderRadius: BUBBLE / 2,
  },
  bubble: { alignItems: 'center', justifyContent: 'center' },
  dots: {
    flexDirection: 'row',
    gap: spacing.sm,
    // Room for the bounce, so the message below doesn't move.
    paddingTop: DOT_SIZE,
  },
  dot: { width: DOT_SIZE, height: DOT_SIZE, borderRadius: DOT_SIZE / 2 },
});
