import { router } from 'expo-router';
import { PartyPopper, Sparkles, X, Dumbbell } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useI18n } from '@/i18n';
import { checkAnswer, type AnswerResult } from '@/lib/answer';
import { fetchReviewSession, saveReview } from '@/lib/api/vocabulary';
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
  TextField,
  colors,
  enter,
  haptics,
  spacing,
} from '@/theme';

const SESSION_SIZE = 12;

/** English → user's language (what does it mean?) or the reverse (how do you say it?). */
type Direction = 'enFr' | 'frEn';

type Exercise = {
  key: string;
  direction: Direction;
  item: VocabularyItem;
  /** Expected word or translation (synonyms separated by commas). */
  answer: string;
  /** Language the answer is typed in. */
  answerLang: string;
  /** Retries of missed words don't update the spaced-repetition schedule. */
  retry: boolean;
  /** False for words practised ahead of schedule (free practice). */
  due: boolean;
};

export default function Review() {
  const { award } = useStats();
  const { t, lang } = useI18n();
  const [exercises, setExercises] = useState<Exercise[] | null>(null);
  const [cursor, setCursor] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [finishing, setFinishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchReviewSession(SESSION_SIZE, lang)
      .then((items) => setExercises(buildSession(items, lang)))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, [lang]);

  if (error || !exercises) {
    return (
      <SafeAreaView style={[styles.safe, styles.center]}>
        {error ? (
          <View style={styles.centerBox}>
            <Text color={colors.danger}>{error}</Text>
            <Button label={t.common.back} variant="secondary" onPress={() => router.back()} />
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
            {t.review.nothingTitle}
          </Text>
          <Text align="center" color={colors.textSecondary}>
            {t.review.nothingText}
          </Text>
          <Button label={t.common.back} onPress={() => router.back()} />
        </Animated.View>
      </SafeAreaView>
    );
  }

  const current = exercises[cursor];

  /** Records an answer, schedules a retry if missed, then moves on. */
  async function answer(ex: Exercise, result: AnswerResult) {
    const isCorrect = result !== 'wrong';
    let queue = exercises!;
    if (!ex.retry) {
      if (isCorrect) setCorrect((n) => n + 1);
      // Practising ahead of schedule: a right answer keeps the planned date
      // (no inflated interval), a wrong one brings the word back tomorrow.
      if (ex.due || !isCorrect) {
        // A misspelt answer passes, but the word comes back a bit sooner.
        const grade = result === 'exact' ? 'good' : result === 'close' ? 'hard' : 'again';
        saveReview(ex.item.lemmaId, scheduleReview(ex.item, grade)).catch((e) =>
          console.warn('saveReview', e),
        );
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
        title: t.review.score(correctCount, total),
      },
    });
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={t.review.quit}>
            <Icon icon={X} size={28} color={colors.textMuted} />
          </Pressable>
          <ProgressBar
            progress={cursor / exercises.length}
            color={colors.info}
            style={styles.flex}
          />
        </View>

        {finishing || !current ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          <Question key={current.key} ex={current} onDone={(r) => answer(current, r)} />
        )}
      </KeyboardAvoidingView>
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

/** One question per due word, alternating directions. */
function buildSession(items: VocabularyItem[], lang: string): Exercise[] {
  const dueLimit = endOfToday().getTime();
  // A word without translation can't be asked.
  const askable = shuffle(items.filter((i) => i.translation));
  return askable.map((item, i): Exercise => {
    const direction: Direction = i % 2 === 0 ? 'enFr' : 'frEn';
    const frToEn = direction === 'frEn';
    return {
      key: `${item.lemmaId}`,
      direction,
      item,
      answer: frToEn ? item.word : item.translation!,
      answerLang: frToEn ? 'en' : lang,
      retry: false,
      due: new Date(item.dueAt).getTime() <= dueLimit,
    };
  });
}

/** Notes quoting the English ("« by accident » : par accident") would give the answer away. */
const hideEnglishNotes = (translation: string) =>
  translation
    .replace(/\([^)]*«[^)]*\)/g, '')
    .replace(/\s+/g, ' ')
    .trim();

// ---------------------------------------------------------------------------
// Typed answer
// ---------------------------------------------------------------------------

function Question({ ex, onDone }: { ex: Exercise; onDone: (result: AnswerResult) => void }) {
  const { t } = useI18n();
  const [typed, setTyped] = useState('');
  const [result, setResult] = useState<AnswerResult | null>(null);
  const frToEn = ex.direction === 'frEn';
  const prompt = frToEn ? hideEnglishNotes(ex.item.translation ?? '') : ex.item.word;
  const passed = result === 'exact' || result === 'close';

  function check(giveUp = false) {
    if (result || (!giveUp && !typed.trim())) return;
    const r = giveUp ? 'wrong' : checkAnswer(typed, ex.answer, ex.answerLang);
    setResult(r);
    Keyboard.dismiss();
    if (r === 'wrong') haptics.error();
    else haptics.success();
  }

  return (
    <ScrollView contentContainerStyle={styles.exercise} keyboardShouldPersistTaps="handled">
      <Animated.View entering={enter.up()} style={styles.promptBox}>
        <Text variant="heading" align="center" color={colors.textSecondary}>
          {frToEn ? t.review.howDoYouSay : t.review.whatDoesItMean}
        </Text>
        <Text variant="display" align="center" color={colors.primary}>
          {prompt}
        </Text>
        {!frToEn ? (
          <Badge label={posLabel(t, ex.item.pos)} tone="primary" style={styles.pos} />
        ) : null}
        {!frToEn && ex.item.contextSentence ? (
          <Text align="center" color={colors.textSecondary} style={styles.italic}>
            {t.review.quote(ex.item.contextSentence)}
          </Text>
        ) : null}
      </Animated.View>

      <Animated.View entering={enter.up(80)} style={styles.answerBox}>
        <TextField
          value={typed}
          onChangeText={setTyped}
          placeholder={frToEn ? t.review.typeEnglish : t.review.typeTranslation}
          autoFocus
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          returnKeyType="done"
          editable={!result}
          onSubmitEditing={() => check()}
          accessibilityLabel={t.review.yourAnswer}
        />
        {!result ? (
          <>
            <Button label={t.review.check} disabled={!typed.trim()} onPress={() => check()} />
            <Button label={t.review.dontKnow} variant="ghost" onPress={() => check(true)} />
          </>
        ) : null}
      </Animated.View>

      <View style={styles.footerArea}>
        {result ? (
          <Animated.View entering={enter.up()}>
            <Card
              tint={
                passed
                  ? { face: colors.successSoft, edge: colors.success }
                  : { face: colors.accentSoft, edge: colors.danger }
              }>
              <View style={styles.feedbackTitle}>
                <Icon
                  icon={passed ? PartyPopper : Dumbbell}
                  size={22}
                  color={passed ? colors.successShade : colors.dangerShade}
                />
                <Text variant="heading" color={passed ? colors.successShade : colors.dangerShade}>
                  {passed ? t.review.right : t.review.almost}
                </Text>
              </View>
              {result === 'close' ? <Text>{t.review.watchSpelling}</Text> : null}
              {result !== 'exact' ? (
                <Text>
                  {t.review.correctAnswer}
                  <Text variant="bodyBold">{ex.answer}</Text>
                </Text>
              ) : null}
              <Button
                label={t.common.continue}
                variant={passed ? 'success' : 'danger'}
                style={styles.continue}
                onPress={() => onDone(result)}
              />
            </Card>
          </Animated.View>
        ) : null}
      </View>
    </ScrollView>
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
  exercise: { flexGrow: 1, padding: spacing.xl, gap: spacing.xl },
  promptBox: { gap: spacing.sm, paddingVertical: spacing.lg },
  pos: { alignSelf: 'center' },
  italic: { fontStyle: 'italic', marginTop: spacing.xs },
  answerBox: { gap: spacing.md },
  footerArea: { marginTop: 'auto', gap: spacing.md },
  feedbackTitle: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  continue: { marginTop: spacing.md },
});
