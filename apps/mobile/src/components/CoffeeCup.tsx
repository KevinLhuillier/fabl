import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Ellipse, Path } from 'react-native-svg';

const SIZE = 96;
const STEAM_MS = 2200;
/** Horizontal position (in the 96-wide box) and start delay of each wisp. */
const WISPS = [
  { left: 28, delay: 0 },
  { left: 40, delay: 700 },
  { left: 52, delay: 1400 },
];

/** A cup of coffee with steam rising from it: the paywall's "for the price of a coffee". */
export function CoffeeCup() {
  return (
    <View style={styles.box} accessible={false} importantForAccessibility="no-hide-descendants">
      {WISPS.map((w) => (
        <Wisp key={w.left} left={w.left} delay={w.delay} />
      ))}
      <Svg width={SIZE} height={SIZE} viewBox="0 0 96 96" style={StyleSheet.absoluteFill}>
        {/* Saucer */}
        <Ellipse cx={46} cy={86} rx={34} ry={6} fill="rgba(255,255,255,0.35)" />
        {/* Handle */}
        <Path
          d="M70 52 h4 a10 10 0 0 1 0 20 h-5"
          stroke="#FFFFFF"
          strokeWidth={6}
          strokeLinecap="round"
          fill="none"
        />
        {/* Cup */}
        <Path d="M20 46 h52 v18 a20 20 0 0 1 -20 20 h-12 a20 20 0 0 1 -20 -20 z" fill="#FFFFFF" />
        {/* Coffee */}
        <Ellipse cx={46} cy={46} rx={26} ry={5} fill="#7A4A2A" />
      </Svg>
    </View>
  );
}

function Wisp({ left, delay }: { left: number; delay: number }) {
  const reduceMotion = useReducedMotion();
  const rise = useSharedValue(reduceMotion ? 0.5 : 0);

  useEffect(() => {
    if (reduceMotion) return;
    rise.set(
      withDelay(
        delay,
        withRepeat(withTiming(1, { duration: STEAM_MS, easing: Easing.out(Easing.quad) }), -1),
      ),
    );
  }, [rise, delay, reduceMotion]);

  const style = useAnimatedStyle(() => ({
    opacity: interpolate(rise.value, [0, 0.3, 1], [0, 0.85, 0]),
    transform: [
      { translateY: interpolate(rise.value, [0, 1], [6, -10]) },
      { scaleY: interpolate(rise.value, [0, 1], [0.8, 1.15]) },
    ],
  }));

  return (
    <Animated.View style={[styles.wisp, { left }, style]}>
      <Svg width={12} height={34} viewBox="0 0 12 34">
        <Path
          d="M6 32 C1 26, 11 20, 6 14 S11 4, 6 2"
          stroke="#FFFFFF"
          strokeWidth={3}
          strokeLinecap="round"
          fill="none"
        />
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  box: { width: SIZE, height: SIZE },
  wisp: { position: 'absolute', top: 4 },
});
