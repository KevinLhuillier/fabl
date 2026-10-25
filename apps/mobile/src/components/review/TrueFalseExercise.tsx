import { Check, Timer, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { useI18n } from '@/i18n';
import type { TrueFalseExercise as Exercise } from '@/lib/reviewSession';
import { Button, Card, Icon, Text, colors, enter, haptics, radii, spacing } from '@/theme';

import { Feedback } from './Feedback';

/** Time to answer each statement. */
const STATEMENT_MS = 6000;
/** How long the right/wrong colour stays before the next statement. */
const FLASH_MS = 700;

type Answer = 'right' | 'wrong' | 'timeUp';

/**
 * Timed round: "word = translation?" statements one after the other, answered true or
 * false before the bar runs out (no answer counts as wrong).
 */
export function TrueFalseExercise({
  ex,
  onActivity,
  onDone,
}: {
  ex: Exercise;
  onActivity: () => void;
  /** Words whose statement was answered right. */
  onDone: (correctIds: Set<number>) => void;
}) {
  const { t } = useI18n();
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const statement = ex.statements[index];
  const answer = answers[index];
  const finished = answers.length === ex.statements.length && answer === undefined;
  const remaining = useSharedValue(1);

  // Countdown of the current statement.
  useEffect(() => {
    if (!statement || answer) return;
    remaining.set(1);
    remaining.set(withTiming(0, { duration: STATEMENT_MS, easing: Easing.linear }));
    const timer = setTimeout(() => record('timeUp'), STATEMENT_MS);
    return () => {
      clearTimeout(timer);
      cancelAnimation(remaining);
    };
    // `record` only reads the current index, re-created each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, answer, statement]);

  // After the flash, next statement.
  useEffect(() => {
    if (!answer) return;
    const timer = setTimeout(() => setIndex((i) => i + 1), FLASH_MS);
    return () => clearTimeout(timer);
  }, [answer]);

  const barStyle = useAnimatedStyle(() => ({ width: `${remaining.value * 100}%` }));

  function record(a: Answer) {
    setAnswers((prev) => (prev.length > index ? prev : [...prev, a]));
    if (a === 'right') haptics.success();
    else haptics.error();
  }

  function choose(saysTrue: boolean) {
    onActivity();
    if (!statement || answer) return;
    record(saysTrue === statement.isTrue ? 'right' : 'wrong');
  }

  if (finished || !statement) {
    const right = answers.filter((a) => a === 'right').length;
    return (
      <ScrollView contentContainerStyle={styles.exercise}>
        <View style={styles.footerArea}>
          <Feedback
            passed={right === ex.statements.length}
            title={t.review.trueFalseScore(right, ex.statements.length)}
            onContinue={() =>
              onDone(
                new Set(
                  ex.statements.filter((_, i) => answers[i] === 'right').map((s) => s.item.lemmaId),
                ),
              )
            }>
            {ex.statements.map((s, i) => (
              <View key={s.item.lemmaId} style={styles.summaryRow}>
                <Icon
                  icon={answers[i] === 'right' ? Check : X}
                  size={18}
                  color={answers[i] === 'right' ? colors.successShade : colors.dangerShade}
                />
                <Text style={styles.flex}>
                  <Text variant="bodyBold">{s.item.word}</Text>
                  {` — ${s.item.translation}`}
                </Text>
              </View>
            ))}
          </Feedback>
        </View>
      </ScrollView>
    );
  }

  const tint =
    answer === 'right'
      ? { face: colors.successSoft, edge: colors.success }
      : answer
        ? { face: colors.accentSoft, edge: colors.danger }
        : undefined;

  return (
    <ScrollView contentContainerStyle={styles.exercise}>
      <Animated.View entering={enter.up()} style={styles.promptBox}>
        <Text variant="heading" align="center" color={colors.textSecondary}>
          {t.review.trueFalse}
        </Text>
        <Text variant="caption" align="center" color={colors.textMuted}>
          {t.review.statementOf(index + 1, ex.statements.length)}
        </Text>
      </Animated.View>

      <View style={styles.timer}>
        <Icon icon={Timer} size={20} color={colors.streak} />
        <View style={styles.track}>
          <Animated.View style={[styles.fill, barStyle]} />
        </View>
      </View>

      <Animated.View key={index} entering={enter.up()}>
        <Card tint={tint} padding={spacing.xl}>
          <View style={styles.statement}>
            <Text variant="title" align="center" color={colors.primary}>
              {statement.item.word}
            </Text>
            <Text variant="heading" align="center" color={colors.textMuted}>
              =
            </Text>
            <Text variant="title" align="center">
              {statement.shown}
            </Text>
            {answer === 'timeUp' ? (
              <Text variant="bodyBold" align="center" color={colors.dangerShade}>
                {t.review.timeUp}
              </Text>
            ) : null}
          </View>
        </Card>
      </Animated.View>

      <View style={styles.choices}>
        <Button
          label={t.review.false}
          variant="danger"
          disabled={!!answer}
          style={styles.flex}
          onPress={() => choose(false)}
        />
        <Button
          label={t.review.true}
          variant="success"
          disabled={!!answer}
          style={styles.flex}
          onPress={() => choose(true)}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  exercise: { flexGrow: 1, padding: spacing.xl, gap: spacing.xl },
  promptBox: { gap: spacing.xs, paddingVertical: spacing.lg },
  timer: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  track: {
    flex: 1,
    height: 10,
    borderRadius: radii.pill,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: radii.pill, backgroundColor: colors.streak },
  statement: { gap: spacing.sm, alignItems: 'center' },
  choices: { flexDirection: 'row', gap: spacing.md, marginTop: 'auto' },
  flex: { flex: 1 },
  footerArea: { marginTop: 'auto', gap: spacing.md },
  summaryRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
});
