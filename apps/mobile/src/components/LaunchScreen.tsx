import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { BrandGradient } from '@/components/BrandGradient';
import { Loader, Text, enter, fonts, palette } from '@/theme';

const book = require('../../assets/images/splash-icon.png');

/** Same size as the native splash image (`imageWidth` in app.json), so the book doesn't jump. */
const IMAGE_SIZE = 300;
/** Shown at least this long, so the brand registers even when everything is cached. */
const MIN_VISIBLE_MS = 700;
const EXIT_MS = 380;

type Props = {
  /** The app is ready: play the exit, then call `onHidden`. */
  done: boolean;
  /** The wordmark waits for the app font. */
  fontsReady: boolean;
  onHidden: () => void;
};

/**
 * Launch screen taking over from the native splash (a plain color): the icon's gradient,
 * the book floating, the name and bouncing dots, then a fade into the app.
 */
export function LaunchScreen({ done, fontsReady, onHidden }: Props) {
  const reduceMotion = useReducedMotion();
  const [minElapsed, setMinElapsed] = useState(false);
  const float = useSharedValue(0);
  const exit = useSharedValue(0);

  useEffect(() => {
    const timer = setTimeout(() => setMinElapsed(true), MIN_VISIBLE_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!reduceMotion) {
      float.set(
        withRepeat(withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.quad) }), -1, true),
      );
    }
  }, [float, reduceMotion]);

  useEffect(() => {
    if (!done || !minElapsed) return;
    exit.set(withTiming(1, { duration: EXIT_MS, easing: Easing.in(Easing.cubic) }));
    const timer = setTimeout(onHidden, EXIT_MS);
    return () => clearTimeout(timer);
  }, [done, minElapsed, exit, onHidden]);

  const screenStyle = useAnimatedStyle(() => ({ opacity: 1 - exit.value }));
  const bookStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -8 * float.value }, { scale: 1 + 0.12 * exit.value }],
  }));

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, screenStyle]}
      // The first frame is drawn: the native splash can go, this screen looks the same.
      onLayout={() => SplashScreen.hide()}
      pointerEvents={done ? 'none' : 'auto'}>
      <StatusBar style="light" />
      <BrandGradient />

      <View style={styles.center}>
        <Animated.View style={bookStyle}>
          <Image source={book} style={styles.book} />
        </Animated.View>
      </View>
      {/* Below the centered book, so the book stays where the native splash drew it. */}
      <View style={styles.below}>
        {fontsReady ? (
          <Animated.View entering={enter.up(120)}>
            <Text style={styles.wordmark}>Taleway</Text>
          </Animated.View>
        ) : null}
        <Loader dotColors={[palette.white, palette.sun, palette.coral]} style={styles.dots} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  center: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  book: { width: IMAGE_SIZE, height: IMAGE_SIZE },
  below: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '50%',
    marginTop: IMAGE_SIZE * 0.2,
    alignItems: 'center',
  },
  wordmark: {
    fontFamily: fonts.black,
    fontSize: 40,
    lineHeight: 48,
    color: palette.white,
    letterSpacing: 0.5,
  },
  dots: { paddingTop: 0 },
});
