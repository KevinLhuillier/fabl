import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { useI18n } from '@/i18n';
import { hideEnglishNotes, type ScrambleExercise as Exercise } from '@/lib/reviewSession';
import { Button, Text, colors, enter, fonts, haptics, radii, spacing } from '@/theme';

import { Feedback, Meaning } from './Feedback';

/**
 * Letters of the word in disorder: tap them in the right order (tap a placed letter to
 * give it back). Checked once every letter is placed.
 */
export function ScrambleExercise({
  ex,
  onActivity,
  onDone,
}: {
  ex: Exercise;
  onActivity: () => void;
  onDone: (correct: boolean) => void;
}) {
  const { t } = useI18n();
  /** Indices in `ex.letters` of the placed letters, in order. */
  const [placed, setPlaced] = useState<number[]>([]);
  const [result, setResult] = useState<boolean | null>(null);
  const word = ex.item.word.toLowerCase();

  function place(i: number) {
    onActivity();
    if (result !== null || placed.includes(i)) return;
    haptics.tap();
    const next = [...placed, i];
    setPlaced(next);
    if (next.length === ex.letters.length) finish(next.map((j) => ex.letters[j]).join('') === word);
  }

  function unplace(slot: number) {
    onActivity();
    if (result !== null) return;
    haptics.tap();
    setPlaced(placed.filter((_, s) => s !== slot));
  }

  function finish(correct: boolean) {
    setResult(correct);
    if (correct) haptics.success();
    else haptics.error();
  }

  return (
    <ScrollView contentContainerStyle={styles.exercise}>
      <Animated.View entering={enter.up()} style={styles.promptBox}>
        <Text variant="heading" align="center" color={colors.textSecondary}>
          {t.review.scramble}
        </Text>
        <Text variant="title" align="center" color={colors.primary}>
          {hideEnglishNotes(ex.item.translation ?? '')}
        </Text>
      </Animated.View>

      <Animated.View entering={enter.up(80)} style={styles.board}>
        <View style={styles.row}>
          {ex.letters.map((_, slot) => {
            const letter = placed[slot] !== undefined ? ex.letters[placed[slot]!] : null;
            const tone =
              result === null ? styles.slotFilled : result ? styles.slotRight : styles.slotWrong;
            return (
              <Pressable
                key={slot}
                onPress={() => letter && unplace(slot)}
                accessibilityRole="button"
                style={[styles.slot, letter ? tone : null]}>
                <Text style={styles.letter}>{letter ?? ''}</Text>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.row}>
          {ex.letters.map((letter, i) => {
            const used = placed.includes(i);
            return (
              <Pressable
                key={i}
                onPress={() => place(i)}
                disabled={used || result !== null}
                accessibilityRole="button"
                accessibilityLabel={letter}
                style={({ pressed }) => [
                  styles.tile,
                  used && styles.tileUsed,
                  pressed && styles.pressed,
                ]}>
                <Text style={[styles.letter, used && styles.hidden]}>{letter}</Text>
              </Pressable>
            );
          })}
        </View>
        {result === null ? (
          <View style={styles.actions}>
            <Button
              label={t.review.clear}
              variant="secondary"
              disabled={!placed.length}
              onPress={() => {
                onActivity();
                setPlaced([]);
              }}
            />
            <Button label={t.review.dontKnow} variant="ghost" onPress={() => finish(false)} />
          </View>
        ) : null}
      </Animated.View>

      <View style={styles.footerArea}>
        {result !== null ? (
          <Feedback passed={result} onContinue={() => onDone(result)}>
            {!result ? (
              <Text>
                {t.review.correctAnswer}
                <Text variant="bodyBold">{ex.item.word}</Text>
              </Text>
            ) : null}
            <Meaning word={ex.item.word} translation={ex.item.translation} />
          </Feedback>
        ) : null}
      </View>
    </ScrollView>
  );
}

const TILE = 44;

const styles = StyleSheet.create({
  exercise: { flexGrow: 1, padding: spacing.xl, gap: spacing.xl },
  promptBox: { gap: spacing.sm, paddingVertical: spacing.lg },
  board: { gap: spacing.xl },
  row: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.sm },
  slot: {
    width: TILE,
    height: TILE,
    borderRadius: radii.sm,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.borderShade,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotFilled: {
    borderStyle: 'solid',
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  slotRight: {
    borderStyle: 'solid',
    borderColor: colors.success,
    backgroundColor: colors.successSoft,
  },
  slotWrong: {
    borderStyle: 'solid',
    borderColor: colors.danger,
    backgroundColor: colors.accentSoft,
  },
  tile: {
    width: TILE,
    height: TILE,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
    borderBottomWidth: 5,
    borderBottomColor: colors.borderShade,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileUsed: { backgroundColor: colors.border, borderBottomWidth: 2 },
  pressed: { borderBottomWidth: 2, transform: [{ translateY: 3 }] },
  letter: { fontFamily: fonts.black, fontSize: 22, color: colors.text },
  hidden: { opacity: 0 },
  actions: { gap: spacing.sm },
  footerArea: { marginTop: 'auto', gap: spacing.md },
});
