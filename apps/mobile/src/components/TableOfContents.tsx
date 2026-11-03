import { Check, Crown, Lock, Trophy } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { useI18n } from '@/i18n';
import { toRoman } from '@/lib/labels';
import type { ChapterProgress, ChapterSummary } from '@/lib/types';
import {
  colors,
  depth,
  enter,
  haptics,
  Icon,
  levelColors,
  ProgressBar,
  radii,
  spacing,
  Text,
  themed,
  type CefrLevel,
} from '@/theme';

export type ChapterStatus = 'done' | 'current' | 'daily' | 'locked' | 'premium';

/** Premium story read without subscription: which chapters are open (see lib/api/allowance). */
export type ChapterGate = {
  /** Chapters unlocked by the user (any day). */
  unlocked: Set<string>;
  /** Today's unlock is used. */
  usedToday: boolean;
};

type Props = {
  level: CefrLevel;
  chapters: ChapterSummary[];
  progress: Map<string, ChapterProgress>;
  /** Premium story read without subscription; null when every chapter is open. */
  gate: ChapterGate | null;
  onOpen: (chapter: ChapterSummary) => void;
  /** The chapter to read is not unlocked yet and today's unlock is free. */
  onDaily: (chapter: ChapterSummary) => void;
  /** A premium chapter was tapped. */
  onPremium: () => void;
};

/**
 * Chapters are unlocked one after the other: every completed chapter is
 * "done", the first unfinished one is "current", the rest are locked.
 * Without subscription (premium story, `gate`), the chapter to read is "daily" when today's
 * unlock is free, "premium" when it is used; the following ones are "premium".
 */
export function chapterStatuses(
  chapters: ChapterSummary[],
  progress: Map<string, ChapterProgress>,
  gate: ChapterGate | null = null,
): ChapterStatus[] {
  let unlocked = true;
  return chapters.map((c) => {
    if (progress.get(c.id)?.completed) return 'done';
    if (unlocked) {
      unlocked = false;
      if (!gate || gate.unlocked.has(c.id)) return 'current';
      return gate.usedToday ? 'premium' : 'daily';
    }
    return gate ? 'premium' : 'locked';
  });
}

/**
 * The story's table of contents, printed on a page: one line per chapter
 * (roman numeral, title, length), a bookmark ribbon on the chapter to read,
 * and a "Fin" ornament that turns into a trophy once the book is finished.
 */
export function TableOfContents({
  level,
  chapters,
  progress,
  gate,
  onOpen,
  onDaily,
  onPremium,
}: Props) {
  const statuses = chapterStatuses(chapters, progress, gate);
  const allDone = statuses.every((s) => s === 'done');
  const { t } = useI18n();
  const c = levelColors[level];

  return (
    <View style={styles.wrap}>
      <Ornament label={t.toc.contents} color={c.ink} />

      <Animated.View entering={enter.up()} style={styles.sheetWrap}>
        <View style={styles.sheetEdge} />
        <View style={styles.sheet}>
          {chapters.map((chapter, i) => (
            <Animated.View key={chapter.id} entering={enter.up(i * 40)}>
              {i > 0 ? <View style={styles.separator} /> : null}
              <ChapterLine
                level={level}
                chapter={chapter}
                status={statuses[i]!}
                progress={progress.get(chapter.id)}
                onPress={() => {
                  if (statuses[i] === 'locked') {
                    haptics.error();
                    return;
                  }
                  if (statuses[i] === 'premium') {
                    haptics.tap();
                    onPremium();
                    return;
                  }
                  if (statuses[i] === 'daily') {
                    haptics.tap();
                    onDaily(chapter);
                    return;
                  }
                  haptics.press();
                  onOpen(chapter);
                }}
              />
            </Animated.View>
          ))}
        </View>
      </Animated.View>

      <Animated.View entering={enter.up(chapters.length * 40)} style={styles.end}>
        {allDone ? (
          <>
            <View
              style={[styles.trophy, { backgroundColor: colors.xp, borderColor: colors.xpShade }]}>
              <Icon icon={Trophy} size={30} color={colors.textOnColor} />
            </View>
            <Text variant="bodyBold" color={c.ink}>
              {t.toc.storyDone}
            </Text>
          </>
        ) : (
          <Ornament label={t.toc.end} color={colors.textMuted} />
        )}
      </Animated.View>
    </View>
  );
}

function ChapterLine({
  level,
  chapter,
  status,
  progress,
  onPress,
}: {
  level: CefrLevel;
  chapter: ChapterSummary;
  status: ChapterStatus;
  progress: ChapterProgress | undefined;
  onPress: () => void;
}) {
  const { t } = useI18n();
  const c = levelColors[level];
  const locked = status === 'locked';
  const premium = status === 'premium';
  const daily = status === 'daily';
  // The chapter to read, open or opening with today's unlock.
  const current = status === 'current' || daily;
  const pageIndex = progress?.pageIndex ?? 0;
  const started = current && pageIndex > 0;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        premium
          ? t.premium.lockedChapterA11y(chapter.position + 1, chapter.title)
          : t.toc.chapterA11y(chapter.position + 1, chapter.title)
      }
      accessibilityState={{ disabled: locked }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.line,
        current && { backgroundColor: c.soft },
        pressed && !locked && styles.pressed,
      ]}>
      <Text
        variant="title"
        align="center"
        numberOfLines={1}
        adjustsFontSizeToFit
        color={locked ? colors.textMuted : c.ink}
        style={styles.numeral}>
        {toRoman(chapter.position + 1)}
      </Text>

      <View style={styles.body}>
        <Text variant="bodyBold" numberOfLines={2} color={locked ? colors.textMuted : colors.text}>
          {chapter.title}
        </Text>
        {daily ? (
          <Text variant="caption" color={colors.xpShade}>
            {t.premium.dailyChapter}
          </Text>
        ) : current ? (
          <>
            <Text variant="caption" color={c.ink}>
              {started ? t.toc.resume(pageIndex + 1, chapter.pageCount) : t.toc.start}
            </Text>
            {started ? (
              <ProgressBar
                progress={pageIndex / chapter.pageCount}
                color={c.solid}
                trackColor={colors.surface}
                height={8}
                style={styles.chapterProgress}
              />
            ) : null}
          </>
        ) : premium ? (
          <Text variant="caption" color={colors.xpShade}>
            {t.premium.lockedChapter}
          </Text>
        ) : (
          <Text variant="caption" color={colors.textMuted}>
            {t.common.pages(chapter.pageCount)} · {t.common.words(chapter.wordCount)}
          </Text>
        )}
      </View>

      <View style={styles.status}>
        {status === 'done' ? (
          <View style={[styles.check, { backgroundColor: c.solid }]}>
            <Icon icon={Check} size={16} color={colors.textOnColor} />
          </View>
        ) : premium ? (
          <Icon icon={Crown} size={20} color={colors.xpShade} />
        ) : current ? null : (
          <Icon icon={Lock} size={18} color={colors.textMuted} />
        )}
      </View>

      {/* Bookmark ribbon hanging over the status column of the chapter to read. */}
      {current ? (
        <Svg width={20} height={30} viewBox="0 0 20 30" style={styles.ribbon}>
          <Path d="M0 0 H20 V30 L10 23 L0 30 Z" fill={c.solid} />
        </Svg>
      ) : null}
    </Pressable>
  );
}

/** "—— ◆ Label ◆ ——": section title in the style of a printed book. */
function Ornament({ label, color }: { label: string; color: string }) {
  return (
    <View style={styles.ornament} accessibilityRole="header">
      <View style={[styles.ornamentLine, { backgroundColor: color }]} />
      <View style={[styles.diamond, { backgroundColor: color }]} />
      <Text variant="caption" color={color} style={styles.ornamentLabel}>
        {label.toUpperCase()}
      </Text>
      <View style={[styles.diamond, { backgroundColor: color }]} />
      <View style={[styles.ornamentLine, { backgroundColor: color }]} />
    </View>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    wrap: { gap: spacing.lg },
    sheetWrap: { paddingBottom: depth.card },
    // Stacked pages under the sheet.
    sheetEdge: {
      position: 'absolute',
      top: depth.card,
      left: 0,
      right: 0,
      bottom: 0,
      borderRadius: radii.lg,
      backgroundColor: colors.paperEdge,
    },
    sheet: {
      borderRadius: radii.lg,
      borderWidth: 2,
      borderColor: colors.paperEdge,
      backgroundColor: colors.paper,
      paddingVertical: spacing.sm,
      overflow: 'hidden',
    },
    separator: {
      marginHorizontal: spacing.lg,
      borderTopWidth: 2,
      borderStyle: 'dashed',
      borderColor: colors.paperEdge,
    },
    line: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      minHeight: 72,
      paddingVertical: spacing.md,
      paddingLeft: spacing.md,
      paddingRight: spacing.lg,
    },
    pressed: { opacity: 0.7 },
    numeral: { width: 52 },
    body: { flex: 1, gap: 2 },
    chapterProgress: { marginTop: spacing.xs },
    status: { width: 28, alignItems: 'center' },
    check: {
      width: 26,
      height: 26,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
    },
    ribbon: { position: 'absolute', top: 0, right: spacing.lg + 4 },
    ornament: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
    },
    ornamentLine: { width: 36, height: 2, borderRadius: 1, opacity: 0.5 },
    diamond: { width: 6, height: 6, transform: [{ rotate: '45deg' }] },
    ornamentLabel: { letterSpacing: 2 },
    end: { alignItems: 'center', gap: spacing.sm },
    trophy: {
      width: 64,
      height: 64,
      borderRadius: 32,
      borderWidth: 3,
      alignItems: 'center',
      justifyContent: 'center',
    },
  }),
);
