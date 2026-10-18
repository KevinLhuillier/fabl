import {
  Nunito_600SemiBold,
  Nunito_600SemiBold_Italic,
  Nunito_700Bold,
  Nunito_800ExtraBold,
  Nunito_900Black,
} from '@expo-google-fonts/nunito';
import type { TextStyle } from 'react-native';

/** Passed to `useFonts` in the root layout. */
export const fontAssets = {
  Nunito_600SemiBold,
  Nunito_600SemiBold_Italic,
  Nunito_700Bold,
  Nunito_800ExtraBold,
  Nunito_900Black,
};

export const fonts = {
  regular: 'Nunito_600SemiBold',
  italic: 'Nunito_600SemiBold_Italic',
  bold: 'Nunito_700Bold',
  extraBold: 'Nunito_800ExtraBold',
  black: 'Nunito_900Black',
} as const;

/** Text variants. `reading` is tuned for story passages (large, airy line height). */
export const typography = {
  display: { fontFamily: fonts.black, fontSize: 34, lineHeight: 40 },
  title: { fontFamily: fonts.black, fontSize: 26, lineHeight: 32 },
  heading: { fontFamily: fonts.extraBold, fontSize: 20, lineHeight: 26 },
  body: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 23 },
  bodyBold: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 23 },
  reading: { fontFamily: fonts.regular, fontSize: 21, lineHeight: 34 },
  caption: { fontFamily: fonts.bold, fontSize: 13, lineHeight: 17 },
  button: {
    fontFamily: fonts.black,
    fontSize: 16,
    lineHeight: 20,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
} satisfies Record<string, TextStyle>;

export type TypographyVariant = keyof typeof typography;
