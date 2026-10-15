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

/** Reading time at a comfortable learner pace (150 words per minute). */
export const readingMinutes = (words: number) => Math.max(1, Math.round(words / 150));
