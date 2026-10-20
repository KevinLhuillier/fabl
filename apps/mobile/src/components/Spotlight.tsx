import { Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import type { TourStep } from '@/lib/tourSteps';
import { Button, Card, Text, colors, enter, exit, radii, spacing } from '@/theme';

export type Rect = { x: number; y: number; width: number; height: number };

/** Room between the target and the edge of the hole. */
const PAD = spacing.sm;

type Props = {
  step: TourStep;
  index: number;
  count: number;
  /** Target, relative to the overlay; null for a centered bubble. */
  rect: Rect | null;
  /** Size of the overlay. */
  size: { width: number; height: number };
  onNext: () => void;
  onSkip: () => void;
};

/**
 * One step of the guided tour: the screen is dimmed except for a rounded hole
 * around the target, with an explanation bubble on the side that has the most
 * room. Touches never reach the screen underneath.
 */
export function Spotlight({ step, index, count, rect, size, onNext, onSkip }: Props) {
  const { width, height } = size;
  const last = index === count - 1;
  const hole = rect && {
    x: rect.x - PAD,
    y: rect.y - PAD,
    width: rect.width + PAD * 2,
    height: rect.height + PAD * 2,
  };

  const position = !hole
    ? styles.centered
    : height - (hole.y + hole.height) >= hole.y
      ? { top: hole.y + hole.height + spacing.md }
      : { bottom: height - hole.y + spacing.md };

  return (
    <Animated.View
      entering={enter.fade()}
      exiting={exit.fade()}
      style={StyleSheet.absoluteFill}
      onStartShouldSetResponder={() => true}>
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Path
          d={`M0 0H${width}V${height}H0Z${hole ? holePath(hole, radii.md) : ''}`}
          fill={colors.text}
          fillOpacity={0.7}
          fillRule="evenodd"
        />
      </Svg>
      <Animated.View key={index} entering={enter.up()} style={[styles.bubble, position]}>
        <Card>
          <View style={styles.body}>
            <Text variant="caption" color={colors.primary}>
              {index + 1} / {count}
            </Text>
            <Text variant="heading">{step.title}</Text>
            <Text color={colors.textSecondary}>{step.text}</Text>
          </View>
          <View style={styles.actions}>
            {!last ? (
              <Pressable onPress={onSkip} hitSlop={12} accessibilityRole="button">
                <Text variant="bodyBold" color={colors.textMuted}>
                  Passer
                </Text>
              </Pressable>
            ) : null}
            <View style={styles.flex} />
            <Button label={last ? 'Compris' : 'Suivant'} haptic="tap" onPress={onNext} />
          </View>
        </Card>
      </Animated.View>
    </Animated.View>
  );
}

/** Rounded rectangle subpath; with the even-odd rule it cuts a hole in the dimming. */
function holePath({ x, y, width: w, height: h }: Rect, r: number) {
  return (
    `M${x + r} ${y}H${x + w - r}A${r} ${r} 0 0 1 ${x + w} ${y + r}` +
    `V${y + h - r}A${r} ${r} 0 0 1 ${x + w - r} ${y + h}` +
    `H${x + r}A${r} ${r} 0 0 1 ${x} ${y + h - r}` +
    `V${y + r}A${r} ${r} 0 0 1 ${x + r} ${y}Z`
  );
}

const styles = StyleSheet.create({
  bubble: { position: 'absolute', left: spacing.xl, right: spacing.xl },
  centered: { top: 0, bottom: 0, justifyContent: 'center' },
  body: { gap: spacing.xs },
  actions: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.lg },
  flex: { flex: 1 },
});
