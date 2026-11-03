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

/** Dark mode: night surfaces, softened tints; the solid brand colors stay. */
const night = {
  violet: '#8467FF',
  violetSoft: '#2D2654',
  coralSoft: '#47262A',
  sunSoft: '#3F3520',
  flameSoft: '#432E1E',
  mintSoft: '#173B35',
  skySoft: '#1A3149',

  ink: '#F1EFF9',
  inkSoft: '#B3AFC8',
  inkMuted: '#7D7994',
  line: '#37324C',
  lineShade: '#29253A',
  cloud: '#15131D',
  surface: '#211E2C',
  paper: '#2A2621',
  paperShade: '#1D1A16',
} as const;

const lightColors = {
  background: palette.cloud,
  surface: palette.white,
  border: palette.line,
  borderShade: palette.lineShade,
  /** Dimmed screen behind a sheet. */
  backdrop: 'rgba(37,34,58,0.35)',

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
};

export type ColorName = keyof typeof lightColors;
export type Colors = Record<ColorName, string>;

const darkColors: Colors = {
  ...lightColors,
  background: night.cloud,
  surface: night.surface,
  border: night.line,
  borderShade: night.lineShade,
  backdrop: 'rgba(0,0,0,0.55)',

  text: night.ink,
  textSecondary: night.inkSoft,
  textMuted: night.inkMuted,

  primary: night.violet,
  primarySoft: night.violetSoft,
  accentSoft: night.coralSoft,
  successSoft: night.mintSoft,
  xpSoft: night.sunSoft,
  streakSoft: night.flameSoft,
  infoSoft: night.skySoft,

  paper: night.paper,
  paperEdge: night.paperShade,

  disabled: night.line,
  disabledShade: night.lineShade,
};

// -----------------------------------------------------------------------------
// Active scheme
// -----------------------------------------------------------------------------

export type ColorScheme = 'light' | 'dark';

let activeScheme: ColorScheme = 'light';

/** The scheme `colors` and `themed` styles currently read. */
export function getColorScheme(): ColorScheme {
  return activeScheme;
}

/**
 * Switches the scheme. Only ThemeProvider calls it: it then remounts the screens, so every
 * component reads the new values.
 */
export function setColorScheme(scheme: ColorScheme) {
  activeScheme = scheme;
}

/** An object whose every property reads the active scheme's value. */
function live<T extends object>(variants: Record<ColorScheme, T>): T {
  const out = {} as T;
  for (const key of Object.keys(variants.light) as (keyof T)[]) {
    Object.defineProperty(out, key, {
      enumerable: true,
      get: () => variants[activeScheme][key],
    });
  }
  return out;
}

/** Semantic tokens: components use these, never raw palette values. Follow the scheme. */
export const colors: Colors = live({ light: lightColors, dark: darkColors });

/**
 * Styles built for the active scheme: `themed(() => StyleSheet.create({ … colors.x … }))`.
 * The factory runs once per scheme, the first time a style is read in it.
 */
export function themed<T extends object>(factory: () => T): T {
  const cache: Partial<Record<ColorScheme, T>> = {};
  const current = () => (cache[activeScheme] ??= factory());
  return new Proxy({} as T, {
    get: (_, key) => current()[key as keyof T],
    has: (_, key) => key in current(),
    ownKeys: () => Reflect.ownKeys(current()),
    getOwnPropertyDescriptor: (_, key) => {
      const d = Reflect.getOwnPropertyDescriptor(current(), key);
      return d && { ...d, configurable: true };
    },
  });
}

/**
 * Brand gradient (top left → bottom right) of the app icon and the launch screen; the
 * native splash uses its middle color.
 */
export const brandGradient = ['#8E6CFF', '#6C3BE0', '#4E14A0'] as const;

/** `ink`: text and icons in the level color (the shade is too dark on night surfaces). */
type LevelColor = { solid: string; shade: string; soft: string; ink: string };
const level = (solid: string, shade: string, soft: string, darkSoft: string) =>
  live<LevelColor>({
    light: { solid, shade, soft, ink: shade },
    dark: { solid, shade, soft: darkSoft, ink: solid },
  });

/** One color per CEFR level, used by badges and the home path. */
export const levelColors = {
  A1: level(palette.mint, palette.mintShade, palette.mintSoft, night.mintSoft),
  A2: level(palette.sky, palette.skyShade, palette.skySoft, night.skySoft),
  B1: level(palette.violet, palette.violetShade, palette.violetSoft, night.violetSoft),
  B2: level(palette.sun, palette.sunShade, palette.sunSoft, night.sunSoft),
  C1: level(palette.flame, palette.flameShade, palette.flameSoft, night.flameSoft),
  C2: level(palette.coral, palette.coralShade, palette.coralSoft, night.coralSoft),
} as const;

export type CefrLevel = keyof typeof levelColors;
export const CEFR_LEVELS = Object.keys(levelColors) as CefrLevel[];
