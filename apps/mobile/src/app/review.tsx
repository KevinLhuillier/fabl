import { router } from 'expo-router';
import { Check, PartyPopper, Sparkles, X, Dumbbell } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  fetchDistractorPool,
  fetchReviewSession,
  saveReview,
  type DistractorEntry,
} from '@/lib/api/vocabulary';
import { endOfToday } from '@/lib/dates';
import { XP_RULES } from '@/lib/gamification';
import { posLabel } from '@/lib/labels';
import { scheduleReview } from '@/lib/srs';
import { useStats } from '@/lib/stats';
import type { VocabularyItem } from '@/lib/types';
import {
  Badge,
  Button,
  Card,
  Icon,
  IconBubble,
  ProgressBar,
  Text,
  colors,
  enter,
  haptics,
  spacing,
} from '@/theme';

const SESSION_SIZE = 12;

/** EN → FR (what does it mean?) or FR → EN (how do you say it?). */
type Direction = 'enFr' | 'frEn';

type Exercise = {
  key: string;
  direction: Direction;
  item: VocabularyItem;
  /** 4 shuffled options, one equals `answer`. */
  options: string[];
  answer: string;
  /** Retries of missed words don't update the spaced-repetition schedule. */
  retry: boolean;
  /** False for words practised ahead of schedule (free practice). */
  due: boolean;
};

export default function Review() {
  const { award } = useStats();
  const [exercises, setExercises] = useState<Exercise[] | null>(null);
  const [cursor, setCursor] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [finishing, setFinishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([fetchReviewSession(SESSION_SIZE), fetchDistractorPool()])
      .then(([items, pool]) => setExercises(buildSession(items, pool)))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  if (error || !exercises) {
    return (
      <SafeAreaView style={[styles.safe, styles.center]}>
        {error ? (
          <View style={styles.centerBox}>
            <Text color={colors.danger}>{error}</Text>
            <Button label="Retour" variant="secondary" onPress={() => router.back()} />
          </View>
        ) : (
          <ActivityIndicator color={colors.primary} />
        )}
      </SafeAreaView>
    );
  }

  if (!exercises.length) {
    return (
      <SafeAreaView style={[styles.safe, styles.center]}>
        <Animated.View entering={enter.up()} style={styles.centerBox}>
          <IconBubble icon={Sparkles} />
          <Text variant="title" align="center">
            Rien à réviser
          </Text>
          <Text align="center" color={colors.textSecondary}>
            Lis une histoire et touche des mots pour remplir ta liste.
          </Text>
          <Button label="Retour" onPress={() => router.back()} />
        </Animated.View>
      </SafeAreaView>
    );
  }

  const current = exercises[cursor];

  /** Records an answer, schedules a retry if missed, then moves on. */
  async function answer(ex: Exercise, isCorrect: boolean) {
    let queue = exercises!;
    if (!ex.retry) {
      if (isCorrect) setCorrect((n) => n + 1);
      // Practising ahead of schedule: a right answer keeps the planned date
      // (no inflated interval), a wrong one brings the word back tomorrow.
      if (ex.due || !isCorrect) {
        const result = scheduleReview(ex.item, isCorrect ? 'good' : 'again');
        saveReview(ex.item.lemmaId, result).catch((e) => console.warn('saveReview', e));
      }
    }
    if (!isCorrect) {
      queue = [...queue, { ...ex, key: `${ex.key}-retry`, retry: true }];
      setExercises(queue);
    }
    if (cursor + 1 < queue.length) {
      setCursor(cursor + 1);
      return;
    }
    await finish(isCorrect && !ex.retry ? correct + 1 : correct);
  }

  async function finish(correctCount: number) {
    setFinishing(true);
    const xp = correctCount * XP_RULES.reviewCorrectAnswer + XP_RULES.reviewSessionBonus;
    await award('review', xp);
    // Retries are extra practice: only first attempts count in the score.
    const total = exercises!.filter((e) => !e.retry).length;
    router.replace({
      pathname: '/celebration',
      params: {
        kind: 'review',
        xp: String(xp),
        title: `${correctCount} / ${total} bonnes réponses`,
      },
    });
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Quitter la révision">
          <Icon icon={X} size={28} color={colors.textMuted} />
        </Pressable>
        <ProgressBar progress={cursor / exercises.length} color={colors.info} style={styles.flex} />
      </View>

      {finishing || !current ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <Mcq key={current.key} ex={current} onDone={(ok) => answer(current, ok)} />
      )}
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Session building
// ---------------------------------------------------------------------------

function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/**
 * One multiple-choice question per due word, alternating directions.
 * Wrong options come from the translation pool and the session's other words.
 */
function buildSession(items: VocabularyItem[], pool: DistractorEntry[]): Exercise[] {
  const dueLimit = endOfToday().getTime();
  // A word without translation can't be asked as a MCQ.
  const askable = shuffle(items.filter((i) => i.translation));
  return askable.flatMap((item, i): Exercise[] => {
    const direction: Direction = i % 2 === 0 ? 'enFr' : 'frEn';
    const pick = (e: { word: string; translation: string | null }) =>
      direction === 'frEn' ? e.word : (e.translation ?? '');
    const answer = pick(item);
    const candidates = [...pool, ...askable]
      .map(pick)
      .filter((c) => c && c.toLowerCase() !== answer.toLowerCase());
    const distractors = [...new Set(shuffle(candidates))].slice(0, 3);
    if (distractors.length < 3) return [];
    return [
      {
        key: `${item.lemmaId}`,
        direction,
        item,
        answer,
        options: shuffle([answer, ...distractors]),
        retry: false,
        due: new Date(item.dueAt).getTime() <= dueLimit,
      },
    ];
  });
}

// ---------------------------------------------------------------------------
// Multiple choice question
// ---------------------------------------------------------------------------

function Mcq({ ex, onDone }: { ex: Exercise; onDone: (correct: boolean) => void }) {
  const [picked, setPicked] = useState<string | null>(null);
  const frToEn = ex.direction === 'frEn';
  const prompt = frToEn ? (ex.item.translation ?? '') : ex.item.word;
  const isCorrect = picked === ex.answer;

  function pick(option: string) {
    if (picked) return;
    setPicked(option);
    if (option === ex.answer) haptics.success();
    else haptics.error();
  }

  return (
    <View style={styles.exercise}>
      <Animated.View entering={enter.up()} style={styles.promptBox}>
        <Text variant="heading" align="center" color={colors.textSecondary}>
          {frToEn ? 'Comment dit-on en anglais…' : 'Que veut dire…'}
        </Text>
        <Text variant="display" align="center" color={colors.primary}>
          {prompt}
        </Text>
        {!frToEn ? <Badge label={posLabel(ex.item.pos)} tone="primary" style={styles.pos} /> : null}
        {!frToEn && ex.item.contextSentence ? (
          <Text align="center" color={colors.textSecondary} style={styles.italic}>
            « {ex.item.contextSentence} »
          </Text>
        ) : null}
      </Animated.View>

      <View style={styles.options}>
        {ex.options.map((option, i) => {
          const state =
            picked === null
              ? 'idle'
              : option === ex.answer
                ? 'right'
                : option === picked
                  ? 'wrong'
                  : 'dim';
          return (
            <Animated.View key={option} entering={enter.up(80 + i * 50)}>
              <Button
                label={option}
                sentence
                haptic="none"
                variant={state === 'idle' || state === 'dim' ? 'secondary' : undefined}
                colorOverride={
                  state === 'right'
                    ? { face: colors.success, edge: colors.successShade }
                    : state === 'wrong'
                      ? { face: colors.danger, edge: colors.dangerShade }
                      : undefined
                }
                icon={
                  state === 'right' ? (
                    <Icon icon={Check} size={20} color={colors.textOnColor} />
                  ) : state === 'wrong' ? (
                    <Icon icon={X} size={20} color={colors.textOnColor} />
                  ) : undefined
                }
                style={state === 'dim' ? styles.dim : undefined}
                onPress={() => pick(option)}
              />
            </Animated.View>
          );
        })}
      </View>

      <View style={styles.footerArea}>
        {picked ? (
          <Animated.View entering={enter.up()}>
            <Card
              tint={
                isCorrect
                  ? { face: colors.successSoft, edge: colors.success }
                  : { face: colors.accentSoft, edge: colors.danger }
              }>
              <View style={styles.feedbackTitle}>
                <Icon
                  icon={isCorrect ? PartyPopper : Dumbbell}
                  size={22}
                  color={isCorrect ? colors.successShade : colors.dangerShade}
                />
                <Text
                  variant="heading"
                  color={isCorrect ? colors.successShade : colors.dangerShade}>
                  {isCorrect ? 'Bravo !' : 'Presque !'}
                </Text>
              </View>
              {!isCorrect ? (
                <Text>
                  Bonne réponse : <Text variant="bodyBold">{ex.answer}</Text>
                </Text>
              ) : null}
              <Button
                label="Continuer"
                variant={isCorrect ? 'success' : 'danger'}
                style={styles.continue}
                onPress={() => onDone(isCorrect)}
              />
            </Card>
          </Animated.View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  centerBox: { padding: spacing.xl, gap: spacing.lg, alignItems: 'stretch', maxWidth: 420 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  flex: { flex: 1 },
  exercise: { flex: 1, padding: spacing.xl, gap: spacing.xl },
  promptBox: { gap: spacing.sm, paddingVertical: spacing.lg },
  pos: { alignSelf: 'center' },
  italic: { fontStyle: 'italic', marginTop: spacing.xs },
  options: { gap: spacing.md },
  dim: { opacity: 0.5 },
  footerArea: { marginTop: 'auto', gap: spacing.md },
  feedbackTitle: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  continue: { marginTop: spacing.md },
});
