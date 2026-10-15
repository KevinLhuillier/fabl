import { useEffect, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { palette } from '@/theme';

const COLORS = [
  palette.violet,
  palette.coral,
  palette.sun,
  palette.mint,
  palette.sky,
  palette.flame,
];

type Piece = {
  x: number;
  delay: number;
  duration: number;
  size: number;
  color: string;
  spin: number;
  drift: number;
};

/** One-shot confetti burst falling from the top of the screen. */
export function Confetti({ count = 48 }: { count?: number }) {
  const { width, height } = useWindowDimensions();
  // Random layout computed once (lazy initializer), not on every render.
  const [pieces] = useState<Piece[]>(() =>
    Array.from({ length: count }, (_, i) => ({
      x: Math.random() * width,
      delay: Math.random() * 600,
      duration: 1800 + Math.random() * 1400,
      size: 7 + Math.random() * 8,
      color: COLORS[i % COLORS.length]!,
      spin: (Math.random() - 0.5) * 900,
      drift: (Math.random() - 0.5) * 120,
    })),
  );

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {pieces.map((p, i) => (
        <ConfettiPiece key={i} piece={p} fall={height + 40} />
      ))}
    </View>
  );
}

function ConfettiPiece({ piece, fall }: { piece: Piece; fall: number }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.set(
      withDelay(
        piece.delay,
        withTiming(1, { duration: piece.duration, easing: Easing.in(Easing.quad) }),
      ),
    );
  }, [piece, t]);

  const style = useAnimatedStyle(() => ({
    opacity: t.value < 0.85 ? 1 : (1 - t.value) / 0.15,
    transform: [
      { translateX: piece.x + piece.drift * t.value },
      { translateY: -30 + fall * t.value },
      { rotate: `${piece.spin * t.value}deg` },
    ],
  }));

  return (
    <Animated.View
      style={[
        styles.piece,
        { width: piece.size, height: piece.size * 0.55, backgroundColor: piece.color },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  piece: { position: 'absolute', top: 0, left: 0, borderRadius: 2 },
});
