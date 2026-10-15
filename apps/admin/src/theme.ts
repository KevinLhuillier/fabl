/**
 * Same design tokens as the mobile app: the palette is imported from
 * apps/mobile/src/theme and exposed as CSS variables (--primary, --text-muted,
 * --level-a1-solid…), so a color change there applies here too.
 */
import { colors, levelColors, type CefrLevel } from '@mobile-theme/colors';
import { depth, radii, spacing } from '@mobile-theme/spacing';
import type { CSSProperties } from 'react';

export { colors, levelColors, type CefrLevel };
export const CEFR_LEVELS = Object.keys(levelColors) as CefrLevel[];

const kebab = (s: string) => s.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);

export function applyTheme(root = document.documentElement) {
  const set = (name: string, value: string | number) =>
    root.style.setProperty(`--${name}`, typeof value === 'number' ? `${value}px` : value);

  for (const [name, value] of Object.entries(colors)) set(kebab(name), value);
  for (const [level, c] of Object.entries(levelColors)) {
    for (const [tone, value] of Object.entries(c))
      set(`level-${level.toLowerCase()}-${tone}`, value);
  }
  for (const [name, value] of Object.entries(spacing)) set(`space-${name}`, value);
  for (const [name, value] of Object.entries(radii)) set(`radius-${name}`, value);
  set('depth-button', depth.button);
  set('depth-card', depth.card);
}

/** CSS variables of a level, for inline styles: `style={levelVars('B1')}`. */
export function levelVars(level: CefrLevel) {
  const c = levelColors[level];
  return { '--lvl': c.solid, '--lvl-shade': c.shade, '--lvl-soft': c.soft } as CSSProperties;
}
