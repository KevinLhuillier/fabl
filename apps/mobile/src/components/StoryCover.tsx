import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import type { StorySummary } from '@/lib/types';
import { Text, colors, levelColors } from '@/theme';

type Props = {
  story: Pick<StorySummary, 'slug' | 'title' | 'level' | 'cover_url'>;
  /** Width of the cover; the height follows the 2:3 book ratio. */
  width: number | `${number}%`;
  /** Title size on the default cover. */
  size?: 'sm' | 'lg';
  style?: ViewStyle;
};

/** Book proportions (width / height). */
export const COVER_RATIO = 2 / 3;

/**
 * Front cover of a story, drawn as a book: spine on the left, page block on
 * the right. Shows the story's image, or a default cover in the level color
 * (with a motif picked from the slug so two stories never look identical).
 */
export function StoryCover({ story, width, size = 'sm', style }: Props) {
  const [failed, setFailed] = useState(false);
  const showImage = !!story.cover_url && !failed;

  return (
    <View style={[{ width }, style]}>
      {/* Page block peeking out on the right/bottom. */}
      <View style={styles.pages} />
      <View style={styles.cover}>
        {showImage ? (
          <Image
            source={{ uri: story.cover_url! }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={200}
            onError={() => setFailed(true)}
            accessibilityIgnoresInvertColors
          />
        ) : (
          <DefaultCover story={story} size={size} />
        )}
        <View style={styles.spine} />
        <View style={styles.spineLine} />
      </View>
    </View>
  );
}

const MOTIFS = ['stars', 'waves', 'sun', 'dots'] as const;

function motifOf(slug: string) {
  let hash = 0;
  for (const ch of slug) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return MOTIFS[Math.abs(hash) % MOTIFS.length]!;
}

function DefaultCover({ story, size }: Pick<Props, 'story' | 'size'>) {
  const c = levelColors[story.level];
  const motif = motifOf(story.slug);
  const ink = 'rgba(255,255,255,0.22)';

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: c.solid }]}>
      <Svg
        width="100%"
        height="100%"
        viewBox="0 0 100 150"
        preserveAspectRatio="xMidYMid slice"
        style={StyleSheet.absoluteFill}>
        {motif === 'stars' ? (
          <>
            <Circle cx={74} cy={30} r={14} fill={ink} />
            <Circle cx={80} cy={25} r={12} fill={c.solid} />
            {[
              [26, 22, 2.4],
              [44, 38, 1.6],
              [18, 50, 1.4],
              [60, 54, 2],
              [86, 60, 1.4],
              [30, 128, 1.6],
              [76, 132, 2.2],
            ].map(([x, y, r], i) => (
              <Circle key={i} cx={x} cy={y} r={r} fill={ink} />
            ))}
          </>
        ) : null}
        {motif === 'waves'
          ? [112, 124, 136, 148].map((y) => (
              <Path
                key={y}
                d={`M -10 ${y} Q 15 ${y - 10}, 40 ${y} T 90 ${y} T 140 ${y}`}
                stroke={ink}
                strokeWidth={4}
                fill="none"
              />
            ))
          : null}
        {motif === 'sun'
          ? [16, 30, 44, 58].map((r) => (
              <Circle key={r} cx={50} cy={150} r={r} stroke={ink} strokeWidth={5} fill="none" />
            ))
          : null}
        {motif === 'dots'
          ? Array.from({ length: 6 * 3 }, (_, i) => (
              <Circle
                key={i}
                cx={14 + (i % 6) * 15}
                cy={112 + Math.floor(i / 6) * 13 + (i % 2) * 6}
                r={2.6}
                fill={ink}
              />
            ))
          : null}
      </Svg>

      {/* Engraved frame around the title, like a hardcover. */}
      <View style={[styles.frame, size === 'lg' && styles.frameLg]}>
        <View style={[styles.rule, { backgroundColor: colors.textOnColor }]} />
        <Text
          variant={size === 'lg' ? 'heading' : 'bodyBold'}
          color={colors.textOnColor}
          align="center"
          numberOfLines={4}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
          style={styles.title}>
          {story.title}
        </Text>
        <View style={[styles.rule, { backgroundColor: colors.textOnColor }]} />
      </View>
    </View>
  );
}

const RADIUS = 10;
const SPINE = 9;

const styles = StyleSheet.create({
  pages: {
    position: 'absolute',
    top: 3,
    left: SPINE,
    right: -3,
    bottom: -3,
    borderTopRightRadius: RADIUS,
    borderBottomRightRadius: RADIUS,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.paperEdge,
  },
  cover: {
    aspectRatio: COVER_RATIO,
    borderTopLeftRadius: 4,
    borderBottomLeftRadius: 4,
    borderTopRightRadius: RADIUS,
    borderBottomRightRadius: RADIUS,
    overflow: 'hidden',
    backgroundColor: colors.border,
  },
  // Darker band and a hinge highlight: reads as a book on images too.
  spine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: SPINE,
    backgroundColor: 'rgba(0,0,0,0.16)',
  },
  spineLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: SPINE,
    width: 1.5,
    backgroundColor: 'rgba(255,255,255,0.28)',
  },
  frame: {
    position: 'absolute',
    top: '24%',
    left: SPINE + 10,
    right: 10,
    alignItems: 'center',
    gap: 6,
  },
  frameLg: { gap: 10 },
  rule: { width: 28, height: 2, borderRadius: 1, opacity: 0.7 },
  title: { alignSelf: 'stretch' },
});
