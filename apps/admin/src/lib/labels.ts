import type { Level, StoryStatus } from '../../shared/api';

/** Same names as the mobile app (apps/mobile/src/lib/labels.ts). */
export const LEVEL_NAMES: Record<Level, string> = {
  A1: 'Débutant',
  A2: 'Élémentaire',
  B1: 'Intermédiaire',
  B2: 'Intermédiaire avancé',
  C1: 'Avancé',
  C2: 'Maîtrise',
};

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

export const STATUS_LABELS: Record<StoryStatus, string> = {
  draft: 'Brouillon',
  published: 'Publiée',
  modified: 'Modifiée',
  'online-only': 'En ligne sans fichier',
};

export const formatNumber = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

export const plural = (n: number, one: string, many: string) =>
  `${formatNumber(n)} ${n > 1 ? many : one}`;

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

export const formatDate = (iso: string) =>
  new Date(iso).toLocaleString('fr-FR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

/** Rough word count while typing (the exact one comes from spaCy on "Vérifier"). */
export const roughWords = (text: string) => (text.match(/\p{L}[\p{L}'’-]*/gu) ?? []).length;

/** "Where Is Leo?" + A1 → "a1-where-is-leo" (the file name). */
export const slugify = (level: Level, title: string) =>
  `${level}-${title}`
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
