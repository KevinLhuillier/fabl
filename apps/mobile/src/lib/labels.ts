import type { Messages } from '@/i18n';

/** Label of a spaCy universal POS tag. */
export const posLabel = (t: Messages, pos: string) => t.pos[pos] ?? pos.toLowerCase();

/** Chapter numbers, book style: 1 → "I", 14 → "XIV". */
export function toRoman(n: number) {
  const numerals: [number, string][] = [
    [1000, 'M'],
    [900, 'CM'],
    [500, 'D'],
    [400, 'CD'],
    [100, 'C'],
    [90, 'XC'],
    [50, 'L'],
    [40, 'XL'],
    [10, 'X'],
    [9, 'IX'],
    [5, 'V'],
    [4, 'IV'],
    [1, 'I'],
  ];
  let out = '';
  for (const [value, numeral] of numerals) {
    while (n >= value) {
      out += numeral;
      n -= value;
    }
  }
  return out;
}

/** Reading time at a comfortable learner pace (150 words per minute). */
export const readingMinutes = (words: number) => Math.max(1, Math.round(words / 150));
