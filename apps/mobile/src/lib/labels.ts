import type { CefrLevel } from '@/theme';

/** French labels for spaCy's universal POS tags. */
const POS_LABELS: Record<string, string> = {
  NOUN: 'nom',
  PROPN: 'nom propre',
  VERB: 'verbe',
  ADJ: 'adjectif',
  ADV: 'adverbe',
  PRON: 'pronom',
  DET: 'déterminant',
  ADP: 'préposition',
  CCONJ: 'conjonction',
  SCONJ: 'conjonction',
  NUM: 'nombre',
  INTJ: 'interjection',
  PART: 'particule',
};

export const posLabel = (pos: string) => POS_LABELS[pos] ?? pos.toLowerCase();

export const LEVEL_NAMES: Record<CefrLevel, string> = {
  A1: 'Débutant',
  A2: 'Élémentaire',
  B1: 'Intermédiaire',
  B2: 'Intermédiaire avancé',
  C1: 'Avancé',
  C2: 'Maîtrise',
};

export const plural = (n: number, one: string, many: string) =>
  `${formatNumber(n)} ${n > 1 ? many : one}`;

/** "2 699" with a narrow no-break space, French style (no Intl dependency). */
export const formatNumber = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

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
