import {
  Easing,
  FadeIn,
  FadeInUp,
  FadeOut,
  SlideInDown,
  SlideOutDown,
  type WithSpringConfig,
} from 'react-native-reanimated';

/** Shared spring presets for interactive feedback (press, progress). */
export const springs = {
  /** Button press/release: fast, almost no bounce. */
  press: { damping: 18, stiffness: 420, mass: 0.6 },
  /** Small "pop" on value changes (badges). */
  pop: { damping: 16, stiffness: 260, mass: 0.8 },
  /** Progress bars: smooth, no visible overshoot. */
  gentle: { damping: 22, stiffness: 140, mass: 1 },
} satisfies Record<string, WithSpringConfig>;

const easeOut = Easing.out(Easing.cubic);
const easeIn = Easing.in(Easing.cubic);

/**
 * Entering/exiting layout animations. Timing-based (no spring bounce) so the
 * UI feels calm: short fades with a small upward slide.
 * Each call returns a fresh builder (builders are mutable).
 */
export const enter = {
  /** Content appearing: fade + slide up a few pixels. */
  up: (delay = 0) => FadeInUp.duration(280).delay(delay).easing(easeOut),
  /** Plain fade. */
  fade: (delay = 0) => FadeIn.duration(240).delay(delay),
  /** Bottom sheet sliding up from the bottom edge. */
  sheet: () => SlideInDown.duration(300).easing(easeOut),
};

export const exit = {
  fade: () => FadeOut.duration(180),
  sheet: () => SlideOutDown.duration(220).easing(easeIn),
};
