import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { useI18n } from '@/i18n';
import { shortTranslation, shuffle, type PairsExercise as Exercise } from '@/lib/reviewSession';
import { Text, colors, enter, haptics, radii, spacing } from '@/theme';

import { Feedback } from './Feedback';

type Side = 'word' | 'meaning';
type Pick = { side: Side; lemmaId: number };

/**
 * Two columns, English words and translations, to match by tapping one of each. A wrong
 * pair flashes red and counts as a mistake for both words; the game ends when all match.
 */
export function PairsExercise({
  ex,
  onActivity,
  onDone,
}: {
  ex: Exercise;
  onActivity: () => void;
  /** Words matched without any mistake. */
  onDone: (correctIds: Set<number>) => void;
}) {
  const { t } = useI18n();
  const words = useMemo(() => shuffle(ex.items), [ex.items]);
  const meanings = useMemo(() => shuffle(ex.items), [ex.items]);
  const [picked, setPicked] = useState<Pick | null>(null);
  const [matched, setMatched] = useState<Set<number>>(new Set());
  const [missed, setMissed] = useState<Set<number>>(new Set());
  /** The wrong pair, shown red for a moment. */
  const [wrong, setWrong] = useState<Pick[]>([]);
  const done = matched.size === ex.items.length;

  function tap(side: Side, lemmaId: number) {
    onActivity();
    if (done || matched.has(lemmaId)) return;
    if (!picked || picked.side === side) {
      haptics.tap();
      setPicked({ side, lemmaId });
      return;
    }
    if (picked.lemmaId === lemmaId) {
      haptics.success();
      setMatched(new Set([...matched, lemmaId]));
    } else {
      haptics.error();
      setMissed(new Set([...missed, picked.lemmaId, lemmaId]));
      const pair = [picked, { side, lemmaId }];
      setWrong(pair);
      setTimeout(() => setWrong((w) => (w === pair ? [] : w)), 600);
    }
    setPicked(null);
  }

  const tile = (side: Side, lemmaId: number, label: string) => {
    const isMatched = matched.has(lemmaId);
    const isPicked = picked?.side === side && picked.lemmaId === lemmaId;
    const isWrong = wrong.some((w) => w.side === side && w.lemmaId === lemmaId);
    return (
      <Pressable
        key={`${side}-${lemmaId}`}
        onPress={() => tap(side, lemmaId)}
        disabled={isMatched}
        accessibilityRole="button"
        accessibilityState={{ selected: isPicked, disabled: isMatched }}
        style={({ pressed }) => [
          styles.tile,
          isPicked && styles.picked,
          isWrong && styles.wrong,
          isMatched && styles.matched,
          pressed && styles.pressed,
        ]}>
        <Text
          variant="bodyBold"
          align="center"
          color={isMatched ? colors.successShade : isWrong ? colors.dangerShade : colors.text}>
          {label}
        </Text>
      </Pressable>
    );
  };

  return (
    <ScrollView contentContainerStyle={styles.exercise}>
      <Animated.View entering={enter.up()} style={styles.promptBox}>
        <Text variant="heading" align="center" color={colors.textSecondary}>
          {t.review.pairs}
        </Text>
      </Animated.View>

      <Animated.View entering={enter.up(80)} style={styles.columns}>
        <View style={styles.column}>{words.map((i) => tile('word', i.lemmaId, i.word))}</View>
        <View style={styles.column}>
          {meanings.map((i) => tile('meaning', i.lemmaId, shortTranslation(i.translation!)))}
        </View>
      </Animated.View>

      <View style={styles.footerArea}>
        {done ? (
          <Feedback
            passed={missed.size === 0}
            title={missed.size ? t.review.mistakes(missed.size) : t.review.pairsDone}
            onContinue={() =>
              onDone(new Set(ex.items.map((i) => i.lemmaId).filter((id) => !missed.has(id))))
            }
          />
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  exercise: { flexGrow: 1, padding: spacing.xl, gap: spacing.xl },
  promptBox: { gap: spacing.sm, paddingVertical: spacing.lg },
  columns: { flexDirection: 'row', gap: spacing.md },
  column: { flex: 1, gap: spacing.md },
  tile: {
    minHeight: 64,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
    borderBottomWidth: 5,
    borderBottomColor: colors.borderShade,
    alignItems: 'center',
    justifyContent: 'center',
  },
  picked: {
    borderColor: colors.primary,
    borderBottomColor: colors.primaryShade,
    backgroundColor: colors.primarySoft,
  },
  wrong: {
    borderColor: colors.danger,
    borderBottomColor: colors.dangerShade,
    backgroundColor: colors.accentSoft,
  },
  matched: {
    borderColor: colors.success,
    borderBottomColor: colors.success,
    backgroundColor: colors.successSoft,
    borderBottomWidth: 2,
  },
  pressed: { borderBottomWidth: 2, transform: [{ translateY: 3 }] },
  footerArea: { marginTop: 'auto', gap: spacing.md },
});
