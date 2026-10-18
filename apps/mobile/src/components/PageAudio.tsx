import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { Pause, Play, RotateCcw } from 'lucide-react-native';
import { useEffect } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Icon, ProgressBar, Text, colors, haptics, radii, spacing } from '@/theme';

// The voice-over must play even with the iPhone's silent switch on.
let audioModeSet = false;
function ensureAudioMode() {
  if (audioModeSet) return;
  audioModeSet = true;
  setAudioModeAsync({ playsInSilentMode: true }).catch((e) => console.warn('setAudioMode', e));
}

const formatTime = (seconds: number) => {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/**
 * Player for a page's recorded voice-over. Mount it with `key={page.id}`: each
 * page gets its own player, released (and silenced) when the page changes.
 */
export function PageAudio({ uri, color, shade }: { uri: string; color: string; shade: string }) {
  const player = useAudioPlayer(uri);
  const status = useAudioPlayerStatus(player);
  const ended = status.duration > 0 && status.currentTime >= status.duration - 0.25;

  useEffect(ensureAudioMode, []);

  function toggle() {
    haptics.tap();
    if (status.playing) {
      player.pause();
      return;
    }
    if (ended) void player.seekTo(0);
    player.play();
  }

  const loading = !status.isLoaded || (status.playing && status.isBuffering);
  const icon = status.playing ? Pause : ended ? RotateCcw : Play;

  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={toggle}
        disabled={!status.isLoaded}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={status.playing ? 'Mettre en pause la lecture' : 'Écouter la page'}
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
      <ProgressBar
        progress={status.duration ? status.currentTime / status.duration : 0}
        color={color}
        height={10}
        style={styles.bar}
      />
      <Text variant="caption" color={colors.textSecondary} style={styles.time}>
        {formatTime(
          status.playing || status.currentTime > 0
            ? status.duration - status.currentTime
            : status.duration,
        )}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.sm,
    paddingRight: spacing.lg,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  button: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderBottomWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { borderBottomWidth: 1, transform: [{ translateY: 3 }] },
  bar: { flex: 1, width: undefined },
  time: { minWidth: 36, textAlign: 'right', fontVariant: ['tabular-nums'] },
});
