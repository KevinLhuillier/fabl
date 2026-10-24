import { Volume2 } from 'lucide-react-native';
import { Pressable, StyleSheet } from 'react-native';

import { useI18n } from '@/i18n';
import { playPronunciation, usePronunciation } from '@/lib/pronunciation';
import { Icon, colors, haptics } from '@/theme';

/**
 * Speaker that plays the pronunciation of the first of `texts` that has a clip
 * (the spelled form, then its lemma). Hidden when none has one; dimmed while loading.
 */
export function SpeakButton({
  texts,
  size = 40,
  onPlay,
}: {
  texts: string[];
  size?: number;
  /** Called before the word plays (the reader pauses its voice-over). */
  onPlay?: () => void;
}) {
  const { t } = useI18n();
  const url = usePronunciation(texts);
  if (url === null) return null;

  return (
    <Pressable
      onPress={() => {
        if (!url) return;
        haptics.tap();
        onPlay?.();
        playPronunciation(url);
      }}
      disabled={!url}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={t.common.listen(texts[0] ?? '')}
      style={({ pressed }) => [
        styles.button,
        { width: size, height: size, borderRadius: size / 2 },
        !url && styles.loading,
        pressed && styles.pressed,
      ]}>
      <Icon icon={Volume2} size={Math.round(size * 0.5)} color={colors.primary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loading: { opacity: 0.4 },
  pressed: { transform: [{ scale: 0.92 }] },
});
