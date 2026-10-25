import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { Pause, Play, RotateCcw } from 'lucide-react-native';
import { useEffect, useImperativeHandle, type Ref } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { useI18n } from '@/i18n';
import { ensureAudioMode } from '@/lib/audioMode';
import { Icon, colors, haptics } from '@/theme';

/** Lets the reader start the voice-over from a word, or pause it (a word's pronunciation plays). */
export type PageAudioHandle = { playFrom: (ms: number) => void; pause: () => void };

/** Outer size of the player; the button sits inside the progress ring. */
export const PAGE_AUDIO_SIZE = 64;
const RING = 4;
const RADIUS = (PAGE_AUDIO_SIZE - RING) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const BUTTON = PAGE_AUDIO_SIZE - RING * 2 - 4;

/**
 * Compact player for a page's recorded voice-over: one round button (play / pause /
 * replay) circled by the playback progress. Mount it with `key={page.id}`: each
 * page gets its own player, released (and silenced) when the page changes.
 *
 * `onTime` reports the playback position (ms) for the read-along highlighting,
 * or null before the first play and once the recording has ended.
 * `onRestart` fires when the replay button starts the recording over.
 */
export function PageAudio({
  uri,
  color,
  shade,
  style,
  onTime,
  onRestart,
  ref,
}: {
  uri: string;
  color: string;
  shade: string;
  style?: ViewStyle;
  onTime?: (ms: number | null) => void;
  onRestart?: () => void;
  ref?: Ref<PageAudioHandle>;
}) {
  const { t } = useI18n();
  // Frequent updates so the highlighted word keeps up with the voice.
  const player = useAudioPlayer(uri, { updateInterval: 100 });
  const status = useAudioPlayerStatus(player);
  const ended = status.duration > 0 && status.currentTime >= status.duration - 0.25;
  const progress = status.duration ? Math.min(1, status.currentTime / status.duration) : 0;
  const started = status.playing || status.currentTime > 0;

  useEffect(ensureAudioMode, []);

  useEffect(() => {
    onTime?.(started && !ended ? status.currentTime * 1000 : null);
  }, [onTime, started, ended, status.currentTime]);

  useImperativeHandle(
    ref,
    () => ({
      playFrom: (ms: number) => {
        void player.seekTo(ms / 1000);
        player.play();
      },
      pause: () => player.pause(),
    }),
    [player],
  );

  function toggle() {
    haptics.tap();
    if (status.playing) {
      player.pause();
      return;
    }
    if (ended) {
      void player.seekTo(0);
      onRestart?.();
    }
    player.play();
  }

  const loading = !status.isLoaded || (status.playing && status.isBuffering);
  const icon = status.playing ? Pause : ended ? RotateCcw : Play;

  return (
    <View style={[styles.wrap, style]}>
      <Svg width={PAGE_AUDIO_SIZE} height={PAGE_AUDIO_SIZE} style={StyleSheet.absoluteFill}>
        <Circle
          cx={PAGE_AUDIO_SIZE / 2}
          cy={PAGE_AUDIO_SIZE / 2}
          r={RADIUS}
          stroke={colors.border}
          strokeWidth={RING}
          fill={colors.surface}
        />
        {progress > 0 ? (
          <Circle
            cx={PAGE_AUDIO_SIZE / 2}
            cy={PAGE_AUDIO_SIZE / 2}
            r={RADIUS}
            stroke={color}
            strokeWidth={RING}
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={CIRCUMFERENCE * (1 - progress)}
            fill="none"
            // Start at 12 o'clock and fill clockwise.
            transform={`rotate(-90 ${PAGE_AUDIO_SIZE / 2} ${PAGE_AUDIO_SIZE / 2})`}
          />
        ) : null}
      </Svg>
      <Pressable
        onPress={toggle}
        disabled={!status.isLoaded}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={status.playing ? t.reader.pause : t.reader.play}
        style={({ pressed }) => [
          styles.button,
          { backgroundColor: color, borderBottomColor: shade },
          pressed && styles.pressed,
        ]}>
        {loading && !status.playing ? (
          <ActivityIndicator color={colors.textOnColor} />
        ) : (
          <Icon icon={icon} size={22} color={colors.textOnColor} />
        )}
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
  button: {
    width: BUTTON,
    height: BUTTON,
    borderRadius: BUTTON / 2,
    borderBottomWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { borderBottomWidth: 1, transform: [{ translateY: 3 }] },
});
