import { Mic, Square } from 'lucide-react-native';
import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { useI18n } from '@/i18n';
import { Icon, colors, haptics } from '@/theme';

import { PAGE_AUDIO_SIZE } from './PageAudio';

const BUTTON = PAGE_AUDIO_SIZE - 12;

/**
 * Round button that starts or stops reading the page aloud; sized like the voice-over
 * player beside it. While listening it fills with the level color and a ring pulses
 * around it.
 */
export function ReadAloudButton({
  listening,
  color,
  shade,
  onPress,
}: {
  listening: boolean;
  color: string;
  shade: string;
  onPress: () => void;
}) {
  const { t } = useI18n();
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (listening) {
      pulse.value = withRepeat(
        withTiming(1, { duration: 1100, easing: Easing.out(Easing.quad) }),
        -1,
        false,
      );
    } else {
      cancelAnimation(pulse);
      pulse.value = 0;
    }
  }, [listening, pulse]);

  const ring = useAnimatedStyle(() => ({
    opacity: listening ? 0.5 * (1 - pulse.value) : 0,
    transform: [{ scale: 1 + pulse.value * 0.35 }],
  }));

  return (
    <View style={styles.wrap}>
      <Animated.View pointerEvents="none" style={[styles.ring, { backgroundColor: color }, ring]} />
      <Pressable
        onPress={() => {
          haptics.tap();
          onPress();
        }}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={listening ? t.reader.stopReadingAloud : t.reader.readAloud}
        style={({ pressed }) => [
          styles.button,
          listening
            ? { backgroundColor: color, borderColor: shade }
            : { backgroundColor: colors.surface, borderColor: color },
          pressed && styles.pressed,
        ]}>
        <Icon
          icon={listening ? Square : Mic}
          size={listening ? 18 : 24}
          color={listening ? colors.textOnColor : shade}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: PAGE_AUDIO_SIZE,
    height: PAGE_AUDIO_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: BUTTON,
    height: BUTTON,
    borderRadius: BUTTON / 2,
  },
  button: {
    width: BUTTON,
    height: BUTTON,
    borderRadius: BUTTON / 2,
    borderWidth: 3,
    borderBottomWidth: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { borderBottomWidth: 3, transform: [{ translateY: 2 }] },
});
