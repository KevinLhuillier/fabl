/**
 * Taleway palette. Each "solid" color comes with a darker `shade` used for the
 * 3D bottom edge of buttons/cards (the pressed effect moves the face down onto it).
 */
export const palette = {
  violet: '#6C4BF4',
  violetShade: '#4F31C9',
  violetSoft: '#EEE9FF',

  coral: '#FF6B5B',
  coralShade: '#D94A3B',
  coralSoft: '#FFE8E5',

  sun: '#FFC233',
  sunShade: '#D99B0A',
  sunSoft: '#FFF5D9',

  flame: '#FF8A1F',
  flameShade: '#D46A06',
  flameSoft: '#FFEEDC',

  mint: '#21C998',
  mintShade: '#14A079',
  mintSoft: '#DDF8EF',

  sky: '#3BA9FF',
  skyShade: '#1A85D9',
  skySoft: '#E1F2FF',

  ink: '#25223A',
  inkSoft: '#6B6785',
  inkMuted: '#A5A2BA',
  line: '#E6E3F0',
  lineShade: '#D2CEE2',
  cloud: '#F7F6FC',
  paper: '#FFFCF5',
  paperShade: '#EDE5D3',
  white: '#FFFFFF',
} as const;

/** Semantic tokens: components use these, never raw palette values. */
export const colors = {
  background: palette.cloud,
  surface: palette.white,
  border: palette.line,
  borderShade: palette.lineShade,

  text: palette.ink,
  textSecondary: palette.inkSoft,
  textMuted: palette.inkMuted,
  textOnColor: palette.white,

  primary: palette.violet,
  primaryShade: palette.violetShade,
  primarySoft: palette.violetSoft,

  accent: palette.coral,
  accentShade: palette.coralShade,
  accentSoft: palette.coralSoft,

  success: palette.mint,
  successShade: palette.mintShade,
  successSoft: palette.mintSoft,

  danger: palette.coral,
  dangerShade: palette.coralShade,

  xp: palette.sun,
  xpShade: palette.sunShade,
  xpSoft: palette.sunSoft,

  streak: palette.flame,
  streakShade: palette.flameShade,
  streakSoft: palette.flameSoft,

  info: palette.sky,
  infoShade: palette.skyShade,
  infoSoft: palette.skySoft,

  /** Book pages: table of contents, page edges of covers. */
  paper: palette.paper,
  paperEdge: palette.paperShade,

  disabled: palette.line,
  disabledShade: palette.lineShade,
} as const;

/** One color per CEFR level, used by badges and the home path. */
export const levelColors = {
  A1: { solid: palette.mint, shade: palette.mintShade, soft: palette.mintSoft },
  A2: { solid: palette.sky, shade: palette.skyShade, soft: palette.skySoft },
  B1: { solid: palette.violet, shade: palette.violetShade, soft: palette.violetSoft },
  B2: { solid: palette.sun, shade: palette.sunShade, soft: palette.sunSoft },
  C1: { solid: palette.flame, shade: palette.flameShade, soft: palette.flameSoft },
  C2: { solid: palette.coral, shade: palette.coralShade, soft: palette.coralSoft },
} as const;

export type CefrLevel = keyof typeof levelColors;
export const CEFR_LEVELS = Object.keys(levelColors) as CefrLevel[];
