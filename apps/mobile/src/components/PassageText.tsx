import { Fragment } from 'react';
import { StyleSheet, View } from 'react-native';

import type { Token } from '@/lib/types';
import { Text, colors, fonts, haptics, radii, spacing } from '@/theme';

type Props = {
  tokens: Token[];
  selectedPosition: number | null;
  onWordPress: (token: Token) => void;
};

const QUOTE = /^["“”]$/;

/** A token plus whether it sits inside quotation marks. */
type Segment = { token: Token; spoken: boolean; quote?: 'open' | 'close' };

/**
 * Renders a passage from its tokens. Each line is a paragraph; tokens with a
 * lemma are nested <Text> with onPress, so lines still wrap naturally.
 *
 * Spoken words (between quotation marks, quotes included) are shown in
 * italics; the narration around them keeps the normal style.
 * Straight quotes become “curly” ones.
 */
export function PassageText({ tokens, selectedPosition, onWordPress }: Props) {
  const paragraphs = splitParagraphs(tokens).map(markDialogue);

  return (
    <View style={styles.wrap}>
      {paragraphs.map((segments, i) => (
        <Text key={i} variant="reading">
          {segments.map(({ token: t, spoken, quote }) => {
            const style = [
              spoken && styles.spoken,
              t.position === selectedPosition && styles.selected,
            ];
            const label = quote === 'open' ? '“' : quote === 'close' ? '”' : t.text;
            return (
              <Fragment key={t.position}>
                {t.lemma ? (
                  <Text
                    variant="reading"
                    suppressHighlighting
                    onPress={() => {
                      haptics.select();
                      onWordPress(t);
                    }}
                    style={style}>
                    {label}
                  </Text>
                ) : (
                  <Text variant="reading" style={style}>
                    {label}
                  </Text>
                )}
                {t.whitespace.replace(/\n/g, '')}
              </Fragment>
            );
          })}
        </Text>
      ))}
    </View>
  );
}

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
  spoken: { fontFamily: fonts.italic },
  selected: {
    backgroundColor: colors.xpSoft,
    color: colors.primary,
    borderRadius: radii.sm,
  },
});
