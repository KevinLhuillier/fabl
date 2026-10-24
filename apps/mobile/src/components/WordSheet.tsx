import { Check } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SpeakButton } from '@/components/SpeakButton';
import { useI18n } from '@/i18n';
import { posLabel } from '@/lib/labels';
import type { Lemma } from '@/lib/types';
import { Badge, Button, Icon, Text, colors, enter, exit, radii, spacing } from '@/theme';

export type WordSheetState = {
  surface: string;
  lemma: Lemma;
  /** Expression the word belongs to: shown first, and the one added to the user's words. */
  phrase: Lemma | null;
  /** null while the vocabulary insert is pending. */
  added: 'new' | 'existing' | null;
};

type Props = {
  word: WordSheetState | null;
  onClose: () => void;
  /** Called before the word's pronunciation plays. */
  onSpeak?: () => void;
};

/**
 * Bottom sheet with the translation of the tapped word (slides up). For a word
 * of an expression, the expression comes first and the word alone below it.
 * The speaker plays the word as spelled in the text ("took"), else its lemma.
 */
export function WordSheet({ word, onClose, onSpeak }: Props) {
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  if (!word) return null;
  const { lemma, surface, phrase, added } = word;
  const entry = phrase ?? lemma;
  const showLemma = !phrase && surface.toLowerCase() !== lemma.word.toLowerCase();

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View entering={enter.fade()} exiting={exit.fade()} style={styles.backdrop}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityLabel={t.common.close}
        />
      </Animated.View>
      <Animated.View
        entering={enter.sheet()}
        exiting={exit.sheet()}
        style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}>
        <View style={styles.handle} />
        <View style={styles.header}>
          <Text variant="title">{phrase ? phrase.word : surface}</Text>
          <SpeakButton
            texts={phrase ? [phrase.word] : [surface, lemma.word]}
            onPlay={onSpeak}
          />
          <Badge label={posLabel(t, entry.pos)} tone="primary" style={styles.badge} />
        </View>
        {showLemma ? (
          <Text color={colors.textSecondary}>
            {t.wordSheet.baseForm}
            <Text variant="bodyBold">{lemma.word}</Text>
          </Text>
        ) : null}
        <Text variant="heading" color={colors.primary}>
          {entry.translation ?? t.wordSheet.translationSoon}
        </Text>
        {entry.example ? (
          <View style={styles.example}>
            <Text color={colors.textSecondary}>{entry.example}</Text>
          </View>
        ) : null}
        {phrase && lemma.translation ? (
          <Text color={colors.textSecondary}>
            {t.wordSheet.wordAlone}
            <Text variant="bodyBold">{lemma.word}</Text>
            {` — ${lemma.translation}`}
          </Text>
        ) : null}
        <View style={styles.status}>
          {added === 'new' ? <Icon icon={Check} size={16} color={colors.successShade} /> : null}
          <Text variant="caption" color={added === 'new' ? colors.successShade : colors.textMuted}>
            {added === 'new'
              ? t.wordSheet.added
              : added === 'existing'
                ? t.wordSheet.alreadyAdded
                : ' '}
          </Text>
        </View>
        <Button label={t.common.gotIt} onPress={onClose} haptic="tap" />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(37,34,58,0.35)' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    padding: spacing.xl,
    gap: spacing.md,
  },
  handle: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: radii.pill,
    backgroundColor: colors.border,
    marginBottom: spacing.xs,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flexWrap: 'wrap' },
  // Badge pins itself to the top by default; centered on the speaker's height here.
  badge: { alignSelf: 'center' },
  example: {
    backgroundColor: colors.background,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  status: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, minHeight: 18 },
});
