import { memo, useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  WORD_CURRENT,
  WORD_READ,
  WORD_WRONG,
  noReadAlong,
  useWordReadState,
  type ReadAlongStore,
} from '@/lib/readAlongStore';
import type { PlayFromWord, Token } from '@/lib/types';
import { colors, fonts, haptics, radii, spacing, Text, themed } from '@/theme';

type Props = {
  tokens: Token[];
  /** Per paragraph: written text (a diary, a letter), shown in italics behind a rule. */
  written?: boolean[];
  /** Tapped token; when it belongs to an expression, the whole expression is highlighted. */
  selectedPosition: number | null;
  onWordPress: (token: Token) => void;
  /** Voice-over progress; each word subscribes to it, the text itself does not re-render. */
  readAlong?: ReadAlongStore;
  /** Text color of the words already read, background of the word being read. */
  readColor?: string;
  currentColor?: string;
  /** Gesture `playGesture` on a word with a timing (aligned voice-over): play from there. */
  onWordPlay?: (token: Token) => void;
  playGesture?: PlayFromWord;
  /** `onWordPlay` on every word, timed or not (reading aloud starts from any word). */
  playUntimed?: boolean;
};

/** Second tap within this delay = double tap. A single tap waits for it before acting. */
const DOUBLE_TAP_MS = 250;

const QUOTE = /^["“”]$/;

/**
 * Hair space ending every word. Justified lines put words at fractional positions, and
 * Android may then give a word a box a pixel narrower than its text (and italic glyphs
 * overhang their box): the last letter wrapped to a hidden second line and vanished.
 * A trailing space may overflow the box without wrapping, so the letters always fit.
 */
const TAIL_SLACK = ' ';

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
 * Straight quotes become “curly” ones. Written paragraphs (`written`) are all
 * in italics, set off by a rule; consecutive ones share it.
 *
 * While the voice-over plays, the words already read take `readColor` and the
 * word being spoken gets a `currentColor` background (read-along). Reading aloud
 * shows the same way, with the misread words in red.
 */
export const PassageText = memo(function PassageText({
  tokens,
  written,
  selectedPosition,
  onWordPress,
  readAlong = noReadAlong,
  readColor,
  currentColor,
  onWordPlay,
  playGesture = 'double_tap',
  playUntimed = false,
}: Props) {
  const tapped = selectedPosition === null ? null : tokens[selectedPosition];
  const isSelected = (t: Token) =>
    tapped?.phrase ? t.phrase?.start === tapped.phrase.start : t.position === selectedPosition;

  // The layout only depends on the page: computed once, not at every highlighted word.
  const blocks = useMemo(() => {
    const paragraphs = splitParagraphs(tokens).map(markDialogue).map(splitWords);
    // Runs of consecutive paragraphs with the same kind (narration or written).
    const result: { written: boolean; paragraphs: Segment[][][] }[] = [];
    paragraphs.forEach((words, i) => {
      const isWritten = !!written?.[i];
      const last = result[result.length - 1];
      if (last && last.written === isWritten) last.paragraphs.push(words);
      else result.push({ written: isWritten, paragraphs: [words] });
    });
    return result;
  }, [tokens, written]);

  return (
    <View style={styles.wrap}>
      {blocks.map((block, b) => (
        <View key={b} style={[styles.wrap, block.written && styles.written]}>
          {block.paragraphs.map((words, i) => (
            <View key={i} style={styles.paragraph}>
              {words.map((segments) => (
                <View key={segments[0]!.token.position} style={styles.word}>
                  {segments.map(({ token: t, spoken, quote }, j) => (
                    <Word
                      key={t.position}
                      token={t}
                      label={
                        (quote === 'open' ? '“' : quote === 'close' ? '”' : t.text) + TAIL_SLACK
                      }
                      spoken={spoken || block.written}
                      readAlong={readAlong}
                      selected={isSelected(t)}
                      padLeft={j === 0}
                      padRight={j === segments.length - 1}
                      readColor={readColor}
                      currentColor={currentColor}
                      onWordPress={onWordPress}
                      onWordPlay={onWordPlay}
                      playGesture={playGesture}
                      playUntimed={playUntimed}
                    />
                  ))}
                  <Text variant="reading">
                    {segments[segments.length - 1]!.token.whitespace.replace(/\n/g, '')}
                  </Text>
                </View>
              ))}
              <View style={styles.lastLine} />
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
  readAlong: ReadAlongStore;
  selected: boolean;
  /** The highlight overflows into the surrounding whitespace only, never over a glued neighbor. */
  padLeft: boolean;
  padRight: boolean;
  readColor?: string;
  currentColor?: string;
  onWordPress: (token: Token) => void;
  onWordPlay?: (token: Token) => void;
  playGesture: PlayFromWord;
  playUntimed: boolean;
};

/**
 * One token. The read-along highlight is a rounded pill behind the text
 * (a nested <Text> can't have padding or radius).
 */
const Word = memo(function Word({
  token: t,
  label,
  spoken,
  readAlong,
  selected,
  padLeft,
  padRight,
  readColor,
  currentColor,
  onWordPress,
  onWordPlay,
  playGesture,
  playUntimed,
}: WordProps) {
  const progress = useWordReadState(readAlong, t.position);
  const read = (progress & WORD_READ) !== 0;
  const current = (progress & WORD_CURRENT) !== 0;
  // Skipped or misread when reading aloud.
  const wrong = (progress & WORD_WRONG) !== 0;
  // First tap of a possible double tap, waiting for the second one.
  const pendingTap = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => clearTimeout(pendingTap.current ?? undefined), []);

  const playable = !!onWordPlay && (playUntimed || t.startMs !== null);

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
    wrong && styles.wrong,
    selected && styles.selected,
  ];
  return (
    <View>
      {/* Mounted only for the word being read: no animated view per word of the page. */}
      {current ? (
        <View
          pointerEvents="none"
          style={[
            styles.highlight,
            padLeft && styles.highlightLeft,
            padRight && styles.highlightRight,
            { backgroundColor: currentColor },
          ]}
        />
      ) : null}
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

const styles = themed(() =>
  StyleSheet.create({
    wrap: { gap: spacing.lg },
    written: {
      borderLeftWidth: 3,
      borderLeftColor: colors.border,
      paddingLeft: spacing.md,
      marginLeft: spacing.xs,
    },
    // Justified like a book: each line's spare width goes between its words…
    paragraph: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
    // …except on the paragraph's last line, where this empty filler takes it (left-aligned).
    lastLine: { flexGrow: 1 },
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
    },
    highlightLeft: { left: -spacing.xs - spacing.xxs },
    highlightRight: { right: -spacing.xs - spacing.xxs },
    // Underlined too: the C2 level color is close to red.
    wrong: {
      color: colors.danger,
      textDecorationLine: 'underline',
      textDecorationColor: colors.danger,
    },
    selected: {
      backgroundColor: colors.xpSoft,
      color: colors.primary,
      borderRadius: radii.sm,
    },
  }),
);
