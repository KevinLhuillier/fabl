import { Check, Flag, Lock, Play, Trophy, type LucideIcon } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { formatNumber } from '@/lib/labels';
import type { ChapterProgress, ChapterSummary } from '@/lib/types';
import {
  Badge,
  Icon,
  Text,
  colors,
  depth,
  enter,
  haptics,
  levelColors,
  type CefrLevel,
  usePressDepth,
} from '@/theme';

export type ChapterStatus = 'done' | 'current' | 'locked';

type Props = {
  level: CefrLevel;
  chapters: ChapterSummary[];
  progress: Map<string, ChapterProgress>;
  onOpen: (chapter: ChapterSummary) => void;
};

// --- Geometry ----------------------------------------------------------------
// Every row has the same height so the trail between nodes can be drawn exactly.

/** Diameter of a chapter node. */
const NODE = 80;
/** Height of one row (bubble + node + title + word count). */
const ROW = 190;
/** Vertical position of a node's top inside its row (room above for the bubble). */
const NODE_TOP = 34;
/** Width of the title block under a node. */
const LABEL = 150;
/** Horizontal offsets of the zigzag from the center, in px. */
const ZIGZAG = [0, 56, 72, 56, 0, -56, -72, -56];
/** Start flag row and finish (trophy) row heights. */
const START = 70;
const FINISH = 150;

const STATUS_ICON: Record<ChapterStatus, LucideIcon> = { done: Check, current: Play, locked: Lock };

/**
 * Chapters are unlocked one after the other: every completed chapter is
 * "done", the first unfinished one is "current", the rest are locked.
 */
export function chapterStatuses(
  chapters: ChapterSummary[],
  progress: Map<string, ChapterProgress>,
): ChapterStatus[] {
  let unlocked = true;
  return chapters.map((c) => {
    if (progress.get(c.id)?.completed) return 'done';
    if (unlocked) {
      unlocked = false;
      return 'current';
    }
    return 'locked';
  });
}

/**
 * Duolingo-like path: a start flag, chapter nodes in zigzag joined by a dotted
 * trail (colored where already travelled), and a trophy.
 */
export function ChapterPath({ level, chapters, progress, onOpen }: Props) {
  const [width, setWidth] = useState(0);
  const statuses = chapterStatuses(chapters, progress);
  const allDone = statuses.every((s) => s === 'done');
  const c = levelColors[level];

  const offsetOf = (i: number) => ZIGZAG[i % ZIGZAG.length]!;
  const centerX = (i: number) => width / 2 + offsetOf(i);
  const centerY = (i: number) => START + i * ROW + NODE_TOP + NODE / 2;
  const finishY = START + chapters.length * ROW + 44;
  const height = START + chapters.length * ROW + FINISH;

  // Trail points: start flag → each chapter → trophy.
  const points = [
    { x: width / 2, y: START / 2 },
    ...chapters.map((_, i) => ({ x: centerX(i), y: centerY(i) })),
    { x: centerX(chapters.length), y: finishY },
  ];
  // A segment is "travelled" once the chapter it leaves from is done
  // (the first one, from the start flag, is always travelled).
  const travelled = (segment: number) => segment === 0 || statuses[segment - 1] === 'done';

  return (
    <View style={{ height }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 ? (
        <>
          <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
            {points.slice(1).map((p, i) => {
              const from = points[i]!;
              const midY = (from.y + p.y) / 2;
              return (
                <Path
                  key={i}
                  d={`M ${from.x} ${from.y} C ${from.x} ${midY}, ${p.x} ${midY}, ${p.x} ${p.y}`}
                  stroke={travelled(i) ? c.solid : colors.border}
                  strokeWidth={8}
                  strokeLinecap="round"
                  strokeDasharray="1 16"
                  fill="none"
                />
              );
            })}
          </Svg>

          {/* Start flag */}
          <View style={[styles.flag, { left: width / 2 - 22, top: START / 2 - 22 }]}>
            <Icon icon={Flag} size={22} color={c.shade} />
          </View>

          {chapters.map((chapter, i) => {
            const status = statuses[i]!;
            const p = progress.get(chapter.id);
            const fraction =
              status === 'current' && p && chapter.pageCount ? p.pageIndex / chapter.pageCount : 0;
            const cx = centerX(i);
            const top = START + i * ROW;
            return (
              <Animated.View
                key={chapter.id}
                entering={enter.up(i * 50)}
                style={[styles.row, { top, width }]}>
                <ChapterNode
                  level={level}
                  chapter={chapter}
                  status={status}
                  fraction={fraction}
                  cx={cx}
                  width={width}
                  onPress={() => {
                    if (status === 'locked') {
                      haptics.error();
                      return;
                    }
                    haptics.press();
                    onOpen(chapter);
                  }}
                />
              </Animated.View>
            );
          })}

          {/* Finish line: lights up once every chapter is read. */}
          <Animated.View
            entering={enter.up(chapters.length * 50)}
            style={[styles.row, { top: START + chapters.length * ROW, width }]}>
            <View
              style={[
                styles.trophy,
                { left: centerX(chapters.length) - 44 },
                { backgroundColor: allDone ? colors.xp : colors.surface },
                { borderColor: allDone ? colors.xpShade : colors.border },
              ]}>
              <Icon
                icon={Trophy}
                size={40}
                color={allDone ? colors.textOnColor : colors.textMuted}
              />
            </View>
            <View
              style={[
                styles.label,
                { left: clampLabel(centerX(chapters.length), width), top: 100 },
              ]}>
              <Text variant="bodyBold" align="center" color={allDone ? c.shade : colors.textMuted}>
                {allDone ? 'Histoire terminée !' : 'Fin de l’histoire'}
              </Text>
            </View>
          </Animated.View>
        </>
      ) : null}
    </View>
  );
}

/** Left position of a label block centered on `cx`, kept inside the screen. */
function clampLabel(cx: number, width: number) {
  return Math.max(0, Math.min(width - LABEL, cx - LABEL / 2));
}

function ChapterNode({
  level,
  chapter,
  status,
  fraction,
  cx,
  width,
  onPress,
}: {
  level: CefrLevel;
  chapter: ChapterSummary;
  status: ChapterStatus;
  fraction: number;
  cx: number;
  width: number;
  onPress: () => void;
}) {
  const c = levelColors[level];
  const { faceStyle, pressIn, pressOut } = usePressDepth(depth.button + 2);

  // The chapter to read softly "breathes" to invite the user in.
  const pulse = useSharedValue(1);
  useEffect(() => {
    if (status === 'current') {
      pulse.set(
        withRepeat(
          withSequence(withTiming(1.04, { duration: 1100 }), withTiming(1, { duration: 1100 })),
          -1,
        ),
      );
    }
  }, [status, pulse]);
  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));

  const locked = status === 'locked';
  const face = locked ? colors.disabled : c.solid;
  const edge = locked ? colors.disabledShade : c.shade;

  return (
    <>
      {status === 'current' ? (
        <View style={[styles.bubble, { left: cx - 90 }]}>
          <Badge
            label={fraction > 0 ? `Continuer · ${Math.round(fraction * 100)} %` : 'Commencer'}
            level={level}
            solid
          />
        </View>
      ) : null}

      <Animated.View style={[styles.node, { left: cx - NODE / 2, top: NODE_TOP }, pulseStyle]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Chapitre ${chapter.position + 1} : ${chapter.title}`}
          accessibilityState={{ disabled: locked }}
          onPressIn={locked ? undefined : pressIn}
          onPressOut={locked ? undefined : pressOut}
          onPress={onPress}
          style={{ paddingBottom: depth.button + 2 }}>
          <View style={[styles.nodeEdge, { backgroundColor: edge }]} />
          <Animated.View style={[styles.nodeFace, { backgroundColor: face }, faceStyle]}>
            <Icon
              icon={STATUS_ICON[status]}
              size={34}
              color={locked ? colors.textMuted : colors.textOnColor}
            />
          </Animated.View>
        </Pressable>
      </Animated.View>

      <View style={[styles.label, { left: clampLabel(cx, width), top: NODE_TOP + NODE + 16 }]}>
        <Text variant="caption" align="center" color={locked ? colors.textMuted : c.shade}>
          CHAPITRE {chapter.position + 1} · {formatNumber(chapter.wordCount)} MOTS
        </Text>
        <Text
          variant="bodyBold"
          align="center"
          numberOfLines={2}
          color={locked ? colors.textMuted : colors.text}>
          {chapter.title}
        </Text>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  row: { position: 'absolute', left: 0, height: ROW },
  flag: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubble: { position: 'absolute', top: 0, width: 180, alignItems: 'center' },
  node: { position: 'absolute', width: NODE },
  nodeEdge: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    top: depth.button + 2,
    borderRadius: NODE / 2,
  },
  nodeFace: {
    width: NODE,
    height: NODE,
    borderRadius: NODE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Opaque background: the dotted trail passes behind the labels.
  label: {
    position: 'absolute',
    width: LABEL,
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: colors.background,
  },
  trophy: {
    position: 'absolute',
    top: 0,
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
