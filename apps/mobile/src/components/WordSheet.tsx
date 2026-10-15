import { Check } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { posLabel } from '@/lib/labels';
import type { Lemma } from '@/lib/types';
import { Badge, Button, Icon, Text, colors, enter, exit, radii, spacing } from '@/theme';

export type WordSheetState = {
  surface: string;
  lemma: Lemma;
  /** null while the vocabulary insert is pending. */
  added: 'new' | 'existing' | null;
};

type Props = { word: WordSheetState | null; onClose: () => void };

/** Bottom sheet with the translation of the tapped word (slides up). */
export function WordSheet({ word, onClose }: Props) {
  const insets = useSafeAreaInsets();
  if (!word) return null;
  const { lemma, surface, added } = word;
  const showLemma = surface.toLowerCase() !== lemma.word.toLowerCase();

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View entering={enter.fade()} exiting={exit.fade()} style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Fermer" />
      </Animated.View>
      <Animated.View
        entering={enter.sheet()}
        exiting={exit.sheet()}
        style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}>
        <View style={styles.handle} />
        <View style={styles.header}>
          <Text variant="title">{surface}</Text>
          <Badge label={posLabel(lemma.pos)} tone="primary" />
        </View>
        {showLemma ? (
          <Text color={colors.textSecondary}>
            forme de base : <Text variant="bodyBold">{lemma.word}</Text>
          </Text>
        ) : null}
        <Text variant="heading" color={colors.primary}>
          {lemma.translation ?? 'Traduction bientôt disponible'}
        </Text>
        {lemma.example ? (
          <View style={styles.example}>
            <Text color={colors.textSecondary}>{lemma.example}</Text>
          </View>
        ) : null}
        <View style={styles.status}>
          {added === 'new' ? <Icon icon={Check} size={16} color={colors.successShade} /> : null}
          <Text variant="caption" color={added === 'new' ? colors.successShade : colors.textMuted}>
            {added === 'new'
              ? 'Ajouté à tes mots'
              : added === 'existing'
                ? 'Déjà dans tes mots'
                : ' '}
          </Text>
        </View>
        <Button label="Compris" onPress={onClose} haptic="tap" />
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
  example: {
    backgroundColor: colors.background,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  status: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, minHeight: 18 },
});
