import { memo, useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import type { PlayFromWord, Token } from '@/lib/types';
import { Text, colors, fonts, haptics, radii, spacing } from '@/theme';

/** Voice-over progress: tokens up to `readUpTo` are read, `current` is being spoken. */
export type ReadAlong = { readUpTo: number; current: number | null };

type Props = {
  tokens: Token[];
  /** Tapped token; when it belongs to an expression, the whole expression is highlighted. */
  selectedPosition: number | null;
  onWordPress: (token: Token) => void;
  readAlong?: ReadAlong | null;
  /** Text color of the words already read, background of the word being read. */
  readColor?: string;
  currentColor?: string;
  /** Gesture `playGesture` on a word with a timing (aligned voice-over): play from there. */
  onWordPlay?: (token: Token) => void;
  playGesture?: PlayFromWord;
};

/** Second tap within this delay = double tap. A single tap waits for it before acting. */
const DOUBLE_TAP_MS = 250;

const QUOTE = /^["“”]$/;

/** A token plus whether it sits inside quotation marks. */
type Segment = { token: Token; spoken: boolean; quote?: 'open' | 'close' };

/**
 * Renders a passage from its tokens. Each line is a paragraph laid out as a
 * wrapping row of words (glued tokens stay together); tokens with a lemma
 * are pressable.
 *
 * Tapping a word of an expression ("shut" in "shut up") selects the whole
 * expression, even when it is split ("pick it up").
 *
 * Spoken words (between quotation marks, quotes included) are shown in
 * italics; the narration around them keeps the normal style.
 * Straight quotes become “curly” ones.
 *
 * While the voice-over plays, the words already read take `readColor` and the
 * word being spoken gets a `currentColor` background (read-along).
 */
export const PassageText = memo(function PassageText({
  tokens,
  selectedPosition,
  onWordPress,
  readAlong,
  readColor,
  currentColor,
  onWordPlay,
  playGesture = 'double_tap',
}: Props) {
  const paragraphs = splitParagraphs(tokens).map(markDialogue).map(splitWords);
  const tapped = selectedPosition === null ? null : tokens[selectedPosition];
  const isSelected = (t: Token) =>
    tapped?.phrase ? t.phrase?.start === tapped.phrase.start : t.position === selectedPosition;

  return (
    <View style={styles.wrap}>
      {paragraphs.map((words, i) => (
        <View key={i} style={styles.paragraph}>
          {words.map((segments) => (
            <View key={segments[0]!.token.position} style={styles.word}>
              {segments.map(({ token: t, spoken, quote }, j) => (
                <Word
                  key={t.position}
                  token={t}
                  label={quote === 'open' ? '“' : quote === 'close' ? '”' : t.text}
                  spoken={spoken}
                  read={!!readAlong && t.position <= readAlong.readUpTo}
                  current={readAlong?.current === t.position}
                  selected={isSelected(t)}
                  padLeft={j === 0}
                  padRight={j === segments.length - 1}
                  readColor={readColor}
                  currentColor={currentColor}
                  onWordPress={onWordPress}
                  onWordPlay={onWordPlay}
                  playGesture={playGesture}
                />
              ))}
              <Text variant="reading">
                {segments[segments.length - 1]!.token.whitespace.replace(/\n/g, '')}
              </Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
});

type WordProps = {
  token: Token;
  label: string;
  spoken: boolean;
  read: boolean;
  current: boolean;
  selected: boolean;
  /** The highlight overflows into the surrounding whitespace only, never over a glued neighbor. */
  padLeft: boolean;
  padRight: boolean;
  readColor?: string;
  currentColor?: string;
  onWordPress: (token: Token) => void;
  onWordPlay?: (token: Token) => void;
  playGesture: PlayFromWord;
};

/**
 * One token. The read-along highlight is a rounded pill behind the text that
 * fades in and out (a nested <Text> can't have padding, radius or animation).
 */
const Word = memo(function Word({
  token: t,
  label,
  spoken,
  read,
  current,
  selected,
  padLeft,
  padRight,
  readColor,
  currentColor,
  onWordPress,
  onWordPlay,
  playGesture,
}: WordProps) {
  // First tap of a possible double tap, waiting for the second one.
  const pendingTap = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => clearTimeout(pendingTap.current ?? undefined), []);

  const playable = !!onWordPlay && t.startMs !== null;

  const translate = () => onWordPress(t);
  const play = () => onWordPlay!(t);

  const onPress = () => {
    // Without an aligned voice-over a tap can only translate: no double tap to wait for.
    if (!playable) {
      haptics.select();
      translate();
      return;
    }
    if (pendingTap.current) {
      clearTimeout(pendingTap.current);
      pendingTap.current = null;
      haptics.tap();
      if (playGesture === 'double_tap') play();
      else translate();
      return;
    }
    haptics.select();
    pendingTap.current = setTimeout(() => {
      pendingTap.current = null;
      if (playGesture === 'tap') play();
      else translate();
    }, DOUBLE_TAP_MS);
  };

  const style = [
    spoken && styles.spoken,
    read && { color: readColor },
    selected && styles.selected,
  ];
  return (
    <View>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.highlight,
          padLeft && styles.highlightLeft,
          padRight && styles.highlightRight,
          { backgroundColor: currentColor, opacity: current ? 1 : 0 },
        ]}
      />
      {t.lemma ? (
        <Text variant="reading" suppressHighlighting onPress={onPress} style={style}>
          {label}
        </Text>
      ) : (
        <Text variant="reading" style={style}>
          {label}
        </Text>
      )}
    </View>
  );
});

function splitParagraphs(tokens: Token[]): Token[][] {
  const lines: Token[][] = [[]];
  for (const t of tokens) {
    lines[lines.length - 1]!.push(t);
    if (t.whitespace.includes('\n')) lines.push([]);
  }
  return lines.filter((l) => l.length);
}

/** Toggles "spoken" state on each quotation mark of a paragraph. */
function markDialogue(line: Token[]): Segment[] {
  let inside = false;
  return line.map((token) => {
    if (QUOTE.test(token.text)) {
      inside = !inside;
      return { token, spoken: true, quote: inside ? 'open' : 'close' };
    }
    return { token, spoken: inside };
  });
}

/**
 * Groups glued tokens (no whitespace between them, e.g. “Bonjour or mot,)
 * so a line never breaks between them.
 */
function splitWords(line: Segment[]): Segment[][] {
  const words: Segment[][] = [[]];
  for (const s of line) {
    words[words.length - 1]!.push(s);
    if (s.token.whitespace) words.push([]);
  }
  return words.filter((w) => w.length);
}

/**
 * Sentence around a token, used as the vocabulary "context". Sentences end
 * with . ! ? (an ellipsis or closing quote stays attached) or a line break.
 */
export function sentenceAround(tokens: Token[], position: number): string {
  const isEnd = (t: Token) => /^[.!?…]+$/.test(t.text) || t.whitespace.includes('\n');
  let start = position;
  while (start > 0 && !isEnd(tokens[start - 1]!)) start--;
  let end = position;
  while (end < tokens.length - 1 && !isEnd(tokens[end]!)) end++;
  // Keep a closing quote that follows the punctuation.
  if (tokens[end + 1]?.text === '"' && !tokens[end]!.whitespace) end++;
  return tokens
    .slice(start, end + 1)
    .map((t) => t.text + t.whitespace)
    .join('')
    .trim();
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.lg },
  paragraph: { flexDirection: 'row', flexWrap: 'wrap' },
  word: { flexDirection: 'row' },
  spoken: { fontFamily: fonts.italic },
  // Pill around the glyphs (the line box is much taller than the text).
  highlight: {
    position: 'absolute',
    top: spacing.xs,
    bottom: spacing.xs,
    left: 0,
    right: 0,
    borderRadius: radii.sm,
    transitionProperty: 'opacity',
    transitionDuration: 220,
    transitionTimingFunction: 'ease-out',
  },
  highlightLeft: { left: -spacing.xs - spacing.xxs },
  highlightRight: { right: -spacing.xs - spacing.xxs },
  selected: {
    backgroundColor: colors.xpSoft,
    color: colors.primary,
    borderRadius: radii.sm,
  },
});
