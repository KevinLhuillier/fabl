import { AudioLines, Volume2 } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Keyboard, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { useI18n } from '@/i18n';
import { checkAnswer, type AnswerResult } from '@/lib/answer';
import { posLabel } from '@/lib/labels';
import { playPronunciation, usePronunciation } from '@/lib/pronunciation';
import { hideEnglishNotes, type TypedExercise as Exercise } from '@/lib/reviewSession';
import { useSegmentPlayer } from '@/lib/segmentPlayer';
import type { Occurrence } from '@/lib/types';
import {
  Badge,
  Button,
  Icon,
  Text,
  TextField,
  colors,
  enter,
  fonts,
  haptics,
  radii,
  spacing,
} from '@/theme';

import { Feedback, Meaning } from './Feedback';

/**
 * An exercise answered by typing one word: translation, story sentence with a blank,
 * conjugated form, narrator's voice, pronunciation clip, or incomplete expression.
 */
export function TypedExercise({
  ex,
  onActivity,
  onDone,
}: {
  ex: Exercise;
  /** Typing and answering keep the review time counting. */
  onActivity: () => void;
  onDone: (result: AnswerResult) => void;
}) {
  const { t } = useI18n();
  const [typed, setTyped] = useState('');
  const [result, setResult] = useState<AnswerResult | null>(null);
  const passed = result === 'exact' || result === 'close';
  const typesEnglish = ex.kind !== 'translate' || ex.toEnglish;

  function check(giveUp = false) {
    onActivity();
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
        <Prompt ex={ex} answered={!!result} />
      </Animated.View>

      <Animated.View entering={enter.up(80)} style={styles.answerBox}>
        <TextField
          value={typed}
          onChangeText={(text) => {
            onActivity();
            setTyped(text);
          }}
          placeholder={
            ex.kind === 'translate'
              ? ex.toEnglish
                ? t.review.typeEnglish
                : t.review.typeTranslation
              : t.review.typeWord
          }
          // Listening: the keyboard would hide the play buttons before the first listen.
          autoFocus={ex.kind !== 'storyListen' && ex.kind !== 'dictation'}
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
          <Feedback passed={passed} onContinue={() => onDone(result)}>
            {result === 'close' ? <Text>{t.review.watchSpelling}</Text> : null}
            {result !== 'exact' ? (
              <Text>
                {t.review.correctAnswer}
                <Text variant="bodyBold">{ex.answer}</Text>
              </Text>
            ) : null}
            {typesEnglish && ex.kind !== 'translate' ? (
              <Meaning word={ex.item.word} translation={ex.item.translation} />
            ) : null}
          </Feedback>
        ) : null}
      </View>
    </ScrollView>
  );
}

function Prompt({ ex, answered }: { ex: Exercise; answered: boolean }) {
  const { t } = useI18n();
  const hint = hideEnglishNotes(ex.item.translation ?? '');

  switch (ex.kind) {
    case 'translate':
      return (
        <>
          <Heading text={ex.toEnglish ? t.review.howDoYouSay : t.review.whatDoesItMean} />
          <Text variant="display" align="center" color={colors.primary}>
            {ex.toEnglish ? hint : ex.item.word}
          </Text>
          {!ex.toEnglish ? (
            <Badge label={posLabel(t, ex.item.pos)} tone="primary" style={styles.center} />
          ) : null}
          {!ex.toEnglish && ex.item.contextSentence ? (
            <Text align="center" color={colors.textSecondary} style={styles.italic}>
              {t.review.quote(ex.item.contextSentence)}
            </Text>
          ) : null}
        </>
      );
    case 'cloze':
      return (
        <>
          <Heading text={t.review.completeSentence} />
          <Sentence occurrence={ex.occurrence!} revealed={answered} />
          <Hint text={hint} pos={posLabel(t, ex.item.pos)} />
        </>
      );
    case 'conjugate':
      return (
        <>
          <Heading text={t.review.findForm} />
          <Sentence occurrence={ex.occurrence!} revealed={answered} lemma={ex.item.word} />
          <Hint text={hint} pos={posLabel(t, ex.item.pos)} />
        </>
      );
    case 'storyListen':
      return (
        <>
          <Heading text={t.review.listenStory} />
          <StoryAudio occurrence={ex.occurrence!} lemma={ex.item.word} />
          {answered ? <Sentence occurrence={ex.occurrence!} revealed /> : null}
        </>
      );
    case 'dictation':
      return (
        <>
          <Heading text={t.review.listenWord} />
          <WordAudio word={ex.item.word} />
        </>
      );
    case 'expression':
      return (
        <>
          <Heading text={t.review.completeExpression} />
          <Text variant="title" align="center" color={colors.primary}>
            {ex.words!.map((w, i) =>
              i === ex.missing ? (
                <Text
                  key={i}
                  variant="title"
                  color={answered ? colors.successShade : colors.textMuted}>
                  {answered ? w : '____'}
                  {i < ex.words!.length - 1 ? ' ' : ''}
                </Text>
              ) : (
                `${w}${i < ex.words!.length - 1 ? ' ' : ''}`
              ),
            )}
          </Text>
          <Hint text={hint} />
        </>
      );
  }
}

const Heading = ({ text }: { text: string }) => (
  <Text variant="heading" align="center" color={colors.textSecondary}>
    {text}
  </Text>
);

/** Translation (and part of speech) helping to find the hidden word. */
function Hint({ text, pos }: { text: string; pos?: string }) {
  const { t } = useI18n();
  return (
    <View style={styles.hint}>
      {pos ? <Badge label={pos} tone="primary" /> : null}
      <Text align="center" color={colors.textSecondary}>
        {t.review.hint(text)}
      </Text>
    </View>
  );
}

/** The story sentence, the word blanked (and its lemma in brackets) until answered. */
function Sentence({
  occurrence,
  revealed,
  lemma,
}: {
  occurrence: Occurrence;
  revealed: boolean;
  /** conjugate: the base form, shown after the blank. */
  lemma?: string;
}) {
  const { sentence, target } = occurrence;
  return (
    <Text variant="reading" align="center" style={styles.sentence}>
      {sentence.map((tok, i) => {
        if (!target.includes(i)) return tok.text + tok.whitespace;
        return (
          <Text key={i} variant="reading">
            <Text
              variant="reading"
              color={revealed ? colors.successShade : colors.primary}
              style={revealed ? styles.revealed : styles.blank}>
              {revealed ? tok.text : ' '.repeat(Math.max(4, tok.text.length))}
            </Text>
            {lemma && !revealed ? (
              <Text variant="reading" color={colors.textMuted}>{` (${lemma})`}</Text>
            ) : null}
            {tok.whitespace}
          </Text>
        );
      })}
    </Text>
  );
}

/**
 * The word's pronunciation (as spelled in the story, else its lemma), played on arrival,
 * and the story sentence read by the narrator (an excerpt of the page voice-over).
 */
function StoryAudio({ occurrence, lemma }: { occurrence: Occurrence; lemma: string }) {
  const { t } = useI18n();
  const { ready, play, pause } = useSegmentPlayer(occurrence.audioUrl!);
  const { sentence, target } = occurrence;
  const url = usePronunciation([sentence[target[0]!]!.text, lemma]);
  const autoPlayed = useRef(false);

  const timed = sentence.filter((tok) => tok.startMs !== null && tok.endMs !== null);
  const playSentence = () => play(timed[0]!.startMs!, timed[timed.length - 1]!.endMs!);
  const playWord = () => {
    if (!url) return;
    pause();
    playPronunciation(url);
  };

  useEffect(() => {
    if (!url || autoPlayed.current) return;
    autoPlayed.current = true;
    playPronunciation(url);
  }, [url]);

  return (
    <View style={styles.audioBox}>
      {url !== null ? (
        <BigPlay icon={Volume2} label={t.review.playWord} disabled={!url} onPress={playWord} />
      ) : null}
      <Button
        label={t.review.playSentence}
        variant="secondary"
        icon={<Icon icon={AudioLines} size={20} color={colors.primary} />}
        disabled={!ready || !timed.length}
        onPress={playSentence}
      />
    </View>
  );
}

/** The word's pronunciation clip, played on arrival. */
function WordAudio({ word }: { word: string }) {
  const { t } = useI18n();
  const url = usePronunciation([word]);
  const autoPlayed = useRef(false);

  useEffect(() => {
    if (!url || autoPlayed.current) return;
    autoPlayed.current = true;
    playPronunciation(url);
  }, [url]);

  return (
    <View style={styles.audioBox}>
      <BigPlay
        icon={Volume2}
        label={t.review.playWord}
        disabled={!url}
        onPress={() => url && playPronunciation(url)}
      />
    </View>
  );
}

function BigPlay({
  icon,
  label,
  disabled,
  onPress,
}: {
  icon: typeof Volume2;
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={() => {
        haptics.tap();
        onPress();
      }}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.bigPlay, disabled && styles.dim, pressed && styles.pressed]}>
      <Icon icon={icon} size={44} color={colors.textOnColor} />
    </Pressable>
  );
}

const PLAY_SIZE = 96;

const styles = StyleSheet.create({
  exercise: { flexGrow: 1, padding: spacing.xl, gap: spacing.xl },
  promptBox: { gap: spacing.sm, paddingVertical: spacing.lg },
  center: { alignSelf: 'center' },
  italic: { fontStyle: 'italic', marginTop: spacing.xs },
  answerBox: { gap: spacing.md },
  footerArea: { marginTop: 'auto', gap: spacing.md },
  hint: { alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  sentence: { marginTop: spacing.sm },
  blank: {
    backgroundColor: colors.primarySoft,
    borderRadius: radii.sm,
    textDecorationLine: 'underline',
  },
  revealed: { fontFamily: fonts.extraBold, backgroundColor: colors.successSoft },
  audioBox: { alignItems: 'center', gap: spacing.lg, marginTop: spacing.md },
  bigPlay: {
    width: PLAY_SIZE,
    height: PLAY_SIZE,
    borderRadius: PLAY_SIZE / 2,
    backgroundColor: colors.primary,
    borderBottomWidth: 5,
    borderBottomColor: colors.primaryShade,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dim: { opacity: 0.5 },
  pressed: { borderBottomWidth: 1, transform: [{ translateY: 4 }] },
});
