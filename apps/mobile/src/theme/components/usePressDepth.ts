import { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { springs } from '../motion';

/**
 * "3D press" effect shared by Button and Card: the face sits `depth` px above a
 * darker edge and slides down onto it while pressed.
 */
export function usePressDepth(depth: number) {
  const pressed = useSharedValue(0);

  const faceStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: pressed.value * depth }],
  }));

  return {
    faceStyle,
    pressIn: () => {
      pressed.set(withSpring(1, springs.press));
    },
    pressOut: () => {
      pressed.set(withSpring(0, springs.press));
    },
  };
}
