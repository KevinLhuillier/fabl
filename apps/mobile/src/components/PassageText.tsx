import { Fragment } from 'react';
import { Quote } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import type { Token } from '@/lib/types';
import { Icon, Text, colors, haptics, radii, spacing } from '@/theme';

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
 * Paragraphs containing dialogue are shown as a "speech" block (accent bar,
 * tinted background, quote mark): the spoken words keep the normal text style
 * and the narration around them ("he asks") is muted and italic.
 * Straight quotes become “curly” ones.
 */
export function PassageText({ tokens, selectedPosition, onWordPress }: Props) {
  const paragraphs = splitParagraphs(tokens).map(markDialogue);

  return (
    <View style={styles.wrap}>
      {paragraphs.map((segments, i) => {
        const isDialogue = segments.some((s) => s.quote);
        const text = (
          <Text variant="reading">
            {segments.map(({ token: t, spoken, quote }) => {
              const style = [
                isDialogue && (spoken ? styles.spoken : styles.aside),
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
        );
        return isDialogue ? (
          <View key={i} style={styles.dialogue}>
            <View style={styles.quoteMark} pointerEvents="none">
              <Icon icon={Quote} size={18} color={colors.primary} />
            </View>
            {text}
          </View>
        ) : (
          <View key={i}>{text}</View>
        );
      })}
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
  dialogue: {
    backgroundColor: colors.primarySoft,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: spacing.sm,
    paddingLeft: spacing.md,
    // Room for the quote mark in the top-right corner.
    paddingRight: spacing.xxl,
  },
  quoteMark: { position: 'absolute', top: spacing.sm, right: spacing.sm, opacity: 0.35 },
  spoken: { color: colors.text },
  aside: { color: colors.textSecondary, fontStyle: 'italic' },
  selected: {
    backgroundColor: colors.xpSoft,
    color: colors.primary,
    borderRadius: radii.sm,
  },
});
