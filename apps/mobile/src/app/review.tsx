import { useRouter } from 'expo-router';
import { Brain, CalendarClock, Sparkles, Trophy, X } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PairsExercise } from '@/components/review/PairsExercise';
import { ScrambleExercise } from '@/components/review/ScrambleExercise';
import { TrueFalseExercise } from '@/components/review/TrueFalseExercise';
import { TypedExercise } from '@/components/review/TypedExercise';
import { useI18n } from '@/i18n';
import { useActivityTimer } from '@/lib/activity';
import { reviewedToday, startReviewSession } from '@/lib/api/allowance';
import { fetchOccurrences, fetchReviewSession, saveReview } from '@/lib/api/vocabulary';
import { FREE_REVIEW_WORDS, usePremium } from '@/lib/premium';
import { cachedPronunciation, loadPronunciations } from '@/lib/pronunciation';
import {
  buildSession,
  exerciseItems,
  isDue,
  retryExercise,
  type Exercise,
  type WordResult,
} from '@/lib/reviewSession';
import { scheduleReview } from '@/lib/srs';
import type { Occurrence, VocabularyItem } from '@/lib/types';
import {
  Button,
  Icon,
  IconBubble,
  Loader,
  ProgressBar,
  Text,
  colors,
  enter,
  spacing,
} from '@/theme';

/** Due words asked in one session at most (they fit in MAX_STEPS thanks to the games). */
const MAX_WORDS = 50;
// Free accounts: one session a day, FREE_REVIEW_WORDS words at most.
/** With fewer due words, the session is topped up with upcoming ones to this size. */
const MIN_WORDS = 12;

/** Words of a session, where they are used in the stories and which have a pronunciation clip. */
async function loadSession(lang: string, maxWords: number): Promise<Exercise[]> {
  const items = await fetchReviewSession(maxWords, MIN_WORDS, lang);
  const [occurrences] = await Promise.all([
    // Without them (e.g. migration not applied yet) the story exercises are left out.
    fetchOccurrences(items.map((i) => i.lemmaId)).catch((e: unknown) => {
      console.warn('fetchOccurrences', e);
      return new Map<number, Occurrence>();
    }),
    loadPronunciations(items.map((i) => i.word)).catch((e: unknown) =>
      console.warn('pronunciations', e),
    ),
  ]);
  const hasClip = (i: VocabularyItem) => !!cachedPronunciation([i.word]);
  return buildSession(items, occurrences, hasClip, lang);
}

export default function Review() {
  const router = useRouter();
  const { touch, flush, seconds } = useActivityTimer();
  const { t, lang } = useI18n();
  const { premium, ready } = usePremium();
  const [exercises, setExercises] = useState<Exercise[] | null>(null);
  /** Free account that already had today's session. */
  const [limited, setLimited] = useState(false);
  /** Today's session is recorded (at the first answer). */
  const started = useRef(false);
  const [cursor, setCursor] = useState(0);
  /** Words answered right at their first exercise. */
  const [correct, setCorrect] = useState<Set<number>>(new Set());
  const [finishing, setFinishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Wait for the subscription: a free account is limited.
    if (!ready) return;
    let cancelled = false;
    (async () => {
      if (!premium && (await reviewedToday())) {
        if (!cancelled) setLimited(true);
        return;
      }
      const session = await loadSession(lang, premium ? MAX_WORDS : FREE_REVIEW_WORDS);
      if (!cancelled) setExercises(session);
    })().catch((e: unknown) => {
      if (!cancelled) setError(e instanceof Error ? e.message : String(e));
    });
    return () => {
      cancelled = true;
    };
    // Once per screen: subscribing meanwhile must not reload the session under way.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang, ready]);

  if (limited) {
    return (
      <SafeAreaView style={[styles.safe, styles.center]}>
        <Animated.View entering={enter.up()} style={styles.centerBox}>
          <IconBubble icon={CalendarClock} />
          <Text variant="title" align="center">
            {t.review.limitTitle}
          </Text>
          <Text align="center" color={colors.textSecondary}>
            {t.review.limitText(FREE_REVIEW_WORDS)}
          </Text>
          <Button
            label={t.premium.upgrade}
            variant="success"
            onPress={() => router.replace({ pathname: '/paywall', params: { reason: 'review' } })}
          />
          <Button label={t.common.back} variant="secondary" onPress={() => router.back()} />
        </Animated.View>
      </SafeAreaView>
    );
  }

  if (error || !exercises) {
    return (
      <SafeAreaView style={[styles.safe, styles.center]}>
        {error ? (
          <View style={styles.centerBox}>
            <Text color={colors.danger}>{error}</Text>
            <Button label={t.common.back} variant="secondary" onPress={() => router.back()} />
          </View>
        ) : (
          <Loader icon={Brain} message={t.loading.review} />
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

  /** Records the answers, schedules a retry for each missed word, then moves on. */
  async function answer(ex: Exercise, results: WordResult[]) {
    touch();
    if (!started.current && !premium) {
      started.current = true;
      // Counted at the first answer, so opening the screen by mistake costs nothing.
      startReviewSession().catch((e) => console.warn('startReviewSession', e));
    }
    let queue = exercises!;
    const right = new Set(correct);
    const retries: Exercise[] = [];
    for (const { item, result } of results) {
      const isCorrect = result !== 'wrong';
      if (!ex.retry) {
        if (isCorrect) right.add(item.lemmaId);
        // Practising ahead of schedule: a right answer keeps the planned date
        // (no inflated interval), a wrong one brings the word back tomorrow.
        if (isDue(item) || !isCorrect) {
          // A misspelt answer passes, but the word comes back a bit sooner.
          const grade = result === 'exact' ? 'good' : result === 'close' ? 'hard' : 'again';
          saveReview(item.lemmaId, scheduleReview(item, grade)).catch((e) =>
            console.warn('saveReview', e),
          );
        }
      }
      if (!isCorrect) {
        // Unique key: a word can be missed again on its retry.
        const n = queue.length + retries.length;
        const retry = retryExercise(item, lang, n % 2 === 0);
        retries.push({ ...retry, key: `${retry.key}-${n}` });
      }
    }
    setCorrect(right);
    if (retries.length) {
      queue = [...queue, ...retries];
      setExercises(queue);
    }
    if (cursor + 1 < queue.length) {
      setCursor(cursor + 1);
      return;
    }
    await finish(right.size);
  }

  async function finish(correctCount: number) {
    setFinishing(true);
    // The celebration shows today's goal: send the review time first.
    await flush();
    // Retries are extra practice: only first attempts count in the score.
    const total = exercises!.filter((e) => !e.retry).flatMap(exerciseItems).length;
    router.replace({
      pathname: '/celebration',
      params: {
        kind: 'review',
        seconds: String(seconds()),
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
            <Loader
              icon={Trophy}
              message={t.loading.score}
              color={colors.xpShade}
              background={colors.xpSoft}
            />
          </View>
        ) : (
          <ExerciseView
            key={current.key}
            ex={current}
            onActivity={touch}
            onDone={(r) => answer(current, r)}
          />
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/** The exercise's screen; every type reports one result per word it asked. */
function ExerciseView({
  ex,
  onActivity,
  onDone,
}: {
  ex: Exercise;
  onActivity: () => void;
  onDone: (results: WordResult[]) => void;
}) {
  const fromSet = (items: VocabularyItem[], right: Set<number>) =>
    onDone(items.map((item) => ({ item, result: right.has(item.lemmaId) ? 'exact' : 'wrong' })));

  switch (ex.kind) {
    case 'pairs':
      return <PairsExercise ex={ex} onActivity={onActivity} onDone={(r) => fromSet(ex.items, r)} />;
    case 'trueFalse':
      return (
        <TrueFalseExercise
          ex={ex}
          onActivity={onActivity}
          onDone={(r) => fromSet(exerciseItems(ex), r)}
        />
      );
    case 'scramble':
      return (
        <ScrambleExercise
          ex={ex}
          onActivity={onActivity}
          onDone={(ok) => onDone([{ item: ex.item, result: ok ? 'exact' : 'wrong' }])}
        />
      );
    default:
      return (
        <TypedExercise
          ex={ex}
          onActivity={onActivity}
          onDone={(result) => onDone([{ item: ex.item, result }])}
        />
      );
  }
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
});
