import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { Pause, Play, RotateCcw } from 'lucide-react-native';
import { memo, useEffect, useImperativeHandle, useRef, type Ref } from 'react';
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
/** How far past the last status update the position is extrapolated (a stall stops it). */
const MAX_EXTRAPOLATION_MS = 500;
/** A frame every 1000/60 ms: what a phone that keeps up takes. */
const FRAME_MS = 1000 / 60;
/** Longest extra lead given to a slow phone (see the highlight loop). */
const MAX_FRAME_LEAD_MS = 120;
/** Progress ring step: finer than this is invisible and only costs a redraw. */
const RING_STEPS = 200;

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
  const running = started && !ended && status.playing;

  useEffect(ensureAudioMode, []);

  // Last position reported by the player, and when it arrived.
  const clock = useRef({ ms: 0, at: 0 });
  useEffect(() => {
    clock.current = { ms: status.currentTime * 1000, at: performance.now() };
  }, [status.currentTime]);

  useEffect(() => {
    if (!running) onTime?.(started && !ended ? status.currentTime * 1000 : null);
  }, [onTime, running, started, ended, status.currentTime]);

  // While playing, the position is extrapolated every frame between two status updates
  // (irregular on Android): short words are no longer skipped and the highlight keeps up.
  useEffect(() => {
    if (!onTime || !running) return;
    const rate = status.playbackRate || 1;
    let last = -1;
    let frame = 0;
    // On a slow phone a frame lasts longer than 16 ms and the word shows a frame or two after
    // it is picked: aim a little further ahead, in proportion to how late the frames are.
    let frameMs = FRAME_MS;
    let lastFrameAt = performance.now();
    const tick = () => {
      const t = performance.now();
      frameMs += (Math.min(t - lastFrameAt, 250) - frameMs) * 0.1;
      lastFrameAt = t;
      const lead = Math.min(MAX_FRAME_LEAD_MS, Math.max(0, frameMs - FRAME_MS) * 1.5);
      const { ms, at } = clock.current;
      let now = ms + Math.min(t - at, MAX_EXTRAPOLATION_MS) * rate + lead;
      // An update slightly behind the extrapolation must not step back a word (a seek may).
      if (now < last && last - now < MAX_EXTRAPOLATION_MS) now = last;
      last = now;
      onTime(now);
      frame = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(frame);
  }, [onTime, running, status.playbackRate]);

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
      <ProgressRing progress={Math.round(progress * RING_STEPS) / RING_STEPS} color={color} />
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

/** The ring: redrawn only when a step is crossed, not at every status update (SVG is costly). */
const ProgressRing = memo(function ProgressRing({
  progress,
  color,
}: {
  progress: number;
  color: string;
}) {
  return (
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
  );
});

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
