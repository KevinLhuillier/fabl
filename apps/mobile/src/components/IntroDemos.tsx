/**
 * The animated demos of the intro slides: a small reader screen where a hand shows the
 * gestures (translate a word, play the voice-over, start it again from a word) and a
 * review card. Each demo plays in a loop while its slide is the one shown.
 *
 * The timeline is a plain async script (`useLoop`) driving Reanimated values: easier to
 * follow than nested animation callbacks, and it stops at once when the slide changes.
 */
import { Check, Pause, Play, Pointer, RotateCcw, Volume2 } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, View, type LayoutChangeEvent, type LayoutRectangle } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { useI18n } from '@/i18n';
import type { PlayFromWord } from '@/lib/types';
import { colors, fonts, Icon, ProgressBar, radii, spacing, springs, Text, themed } from '@/theme';

type Wait = (ms: number) => Promise<void>;
type Point = { x: number; y: number };

/** Height of the demo screen. */
export const DEMO_HEIGHT = 290;
/** The sample text (English, like the stories), one entry per word. */
const SENTENCE = ['The', 'old', 'keeper', 'climbed', 'the', 'stairs', 'of', 'the', 'lighthouse.'];
const OLD = 1;
const KEEPER = 2;
const LIGHTHOUSE = 8;
const WORDS = SENTENCE.length;
/** Voice-over pace of the demo, per word. */
const WORD_MS = 430;
/** Delay between the two touches of a double tap. */
const DOUBLE_TAP_GAP = 170;

/**
 * Runs `script` over and over while `active`; stops at once when it turns false, then
 * `reset` puts the demo back to its first frame.
 */
function useLoop(active: boolean, script: (wait: Wait) => Promise<void>, reset?: () => void) {
  const latest = useRef({ script, reset });
  useEffect(() => {
    latest.current = { script, reset };
  });
  useEffect(() => {
    if (!active) return;
    let stopped = false;
    const timers = new Set<ReturnType<typeof setTimeout>>();
    // Once stopped, a pending wait never resolves: the script goes no further.
    const wait: Wait = (ms) =>
      new Promise((resolve) => {
        const id = setTimeout(() => {
          timers.delete(id);
          if (!stopped) resolve();
        }, ms);
        timers.add(id);
      });
    (async () => {
      while (!stopped) await latest.current.script(wait);
    })().catch(console.warn);
    return () => {
      stopped = true;
      timers.forEach(clearTimeout);
      latest.current.reset?.();
    };
  }, [active]);
}

// ---------------------------------------------------------------------------
// The hand
// ---------------------------------------------------------------------------

const HAND = 46;
/** Fingertip of lucide's Pointer (8, 2 on its 24 grid), where the hand touches. */
const TIP = { x: (8 / 24) * HAND, y: (2 / 24) * HAND };
const RIPPLE = 44;
const MOVE_MS = 650;

function useHand() {
  return {
    x: useSharedValue(0),
    y: useSharedValue(0),
    shown: useSharedValue(0),
    press: useSharedValue(0),
    ripple: useSharedValue(0),
  };
}
type HandValues = ReturnType<typeof useHand>;

const glide = (to: number, duration = MOVE_MS) =>
  withTiming(to, { duration, easing: Easing.inOut(Easing.cubic) });

function placeHand(hand: HandValues, p: Point) {
  hand.x.set(p.x);
  hand.y.set(p.y);
  hand.shown.set(0);
}

async function moveHand(hand: HandValues, p: Point, wait: Wait, duration = MOVE_MS) {
  hand.shown.set(withTiming(1, { duration: 200 }));
  hand.x.set(glide(p.x, duration));
  hand.y.set(glide(p.y, duration));
  await wait(duration);
}

async function leaveHand(hand: HandValues, p: Point, wait: Wait) {
  hand.x.set(glide(p.x));
  hand.y.set(glide(p.y));
  hand.shown.set(withTiming(0, { duration: MOVE_MS }));
  await wait(MOVE_MS);
}

/** One touch: the hand presses and a ripple spreads from the fingertip. */
async function touch(hand: HandValues, wait: Wait) {
  hand.press.set(withSequence(withTiming(1, { duration: 90 }), withTiming(0, { duration: 160 })));
  hand.ripple.set(0);
  hand.ripple.set(withTiming(1, { duration: 520, easing: Easing.out(Easing.quad) }));
  await wait(100);
}

async function gesture(hand: HandValues, kind: PlayFromWord, wait: Wait) {
  await touch(hand, wait);
  if (kind === 'double_tap') {
    await wait(DOUBLE_TAP_GAP);
    await touch(hand, wait);
  }
}

function Hand({ hand }: { hand: HandValues }) {
  const handStyle = useAnimatedStyle(() => ({
    opacity: hand.shown.value,
    transform: [
      { translateX: hand.x.value - TIP.x },
      { translateY: hand.y.value - TIP.y },
      { scale: 1 - hand.press.value * 0.14 },
    ],
  }));
  const rippleStyle = useAnimatedStyle(() => {
    const r = hand.ripple.value;
    return {
      opacity: r > 0 && r < 1 ? hand.shown.value * 0.5 * (1 - r) : 0,
      transform: [
        { translateX: hand.x.value - RIPPLE / 2 },
        { translateY: hand.y.value - RIPPLE / 2 },
        { scale: 0.3 + r * 1.1 },
      ],
    };
  });
  return (
    <>
      <Animated.View pointerEvents="none" style={[styles.ripple, rippleStyle]} />
      <Animated.View pointerEvents="none" style={[styles.hand, handStyle]}>
        {/* Filled underneath, with a thick border: the text never shows through the hand. */}
        <View style={StyleSheet.absoluteFill}>
          <HandFill color={colors.surface} />
        </View>
        {/* Positioned too: on the web a positioned sibling would be painted above it. */}
        <View style={StyleSheet.absoluteFill}>
          <Pointer size={HAND} color={colors.text} strokeWidth={2} />
        </View>
      </Animated.View>
    </>
  );
}

/**
 * Silhouette of lucide's Pointer (its outline is open): fingers, knuckles and palm, filled
 * and stroked wide so it also makes a halo around the outline.
 */
function HandFill({ color }: { color: string }) {
  return (
    <Svg width={HAND} height={HAND} viewBox="0 0 24 24">
      <Rect x={6} y={2} width={4} height={14} rx={2} fill={color} />
      <Rect x={10} y={7} width={4} height={9} rx={2} fill={color} />
      <Rect x={14} y={8} width={4} height={8} rx={2} fill={color} />
      <Rect x={18} y={9} width={4} height={7} rx={2} fill={color} />
      <Path
        d="M18 11a2 2 0 1 1 4 0v3a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15V10h11z"
        fill={color}
      />
      {/* The same outline drawn wide: the halo. */}
      <Path
        d="M22 14a8 8 0 0 1-8 8M18 11v-1a2 2 0 0 0-2-2a2 2 0 0 0-2 2M14 10V9a2 2 0 0 0-2-2a2 2 0 0 0-2 2v1M10 9.5V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v10M18 11a2 2 0 1 1 4 0v3a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"
        stroke={color}
        strokeWidth={5.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

// ---------------------------------------------------------------------------
// The demo screen: text, player, positions
// ---------------------------------------------------------------------------

/** Positions inside the demo screen, read when the script needs them. */
function useLayouts() {
  const screen = useRef<LayoutRectangle | null>(null);
  const text = useRef<LayoutRectangle | null>(null);
  const words = useRef(new Map<number, LayoutRectangle>());
  const [ready, setReady] = useState(false);

  const check = useCallback(() => {
    if (screen.current && text.current && words.current.size === WORDS) setReady(true);
  }, []);
  return {
    ready,
    onScreen: (e: LayoutChangeEvent) => {
      screen.current = e.nativeEvent.layout;
      check();
    },
    onText: (e: LayoutChangeEvent) => {
      text.current = e.nativeEvent.layout;
      check();
    },
    onWord: (i: number) => (e: LayoutChangeEvent) => {
      words.current.set(i, e.nativeEvent.layout);
      check();
    },
    /** Middle of word `i`. */
    word(i: number): Point {
      const w = words.current.get(i)!;
      const origin = text.current!;
      return { x: origin.x + w.x + w.width / 2, y: origin.y + w.y + w.height / 2 + 4 };
    },
    /** Middle of the audio button (centered at the bottom, see `playerRow`). */
    player(): Point {
      const s = screen.current ?? { width: 300, height: DEMO_HEIGHT, x: 0, y: 0 };
      return { x: s.width / 2, y: s.height - spacing.lg - PLAYER / 2 + 4 };
    },
    /** Out of the way, partly below the bottom right corner. */
    rest(): Point {
      const s = screen.current ?? { width: 300, height: DEMO_HEIGHT, x: 0, y: 0 };
      return { x: s.width - 36, y: s.height + 6 };
    },
  };
}
type Layouts = ReturnType<typeof useLayouts>;

function DemoScreen({ layouts, children }: { layouts: Layouts; children: ReactNode }) {
  return (
    <View style={styles.screen} onLayout={layouts.onScreen}>
      {children}
    </View>
  );
}

/**
 * The sample sentence. `pos` is the voice-over position in words (-1 before it starts):
 * the word being read is highlighted, the ones before are colored. `selected` is the
 * word whose translation shows.
 */
function DemoText({
  layouts,
  pos,
  selected,
}: {
  layouts: Layouts;
  pos: SharedValue<number>;
  selected: SharedValue<number>;
}) {
  return (
    <View style={styles.text} onLayout={layouts.onText}>
      {SENTENCE.map((word, i) => (
        <DemoWord
          key={i}
          word={word}
          index={i}
          pos={pos}
          selected={selected}
          onLayout={layouts.onWord(i)}
        />
      ))}
    </View>
  );
}

function DemoWord({
  word,
  index,
  pos,
  selected,
  onLayout,
}: {
  word: string;
  index: number;
  pos: SharedValue<number>;
  selected: SharedValue<number>;
  onLayout: (e: LayoutChangeEvent) => void;
}) {
  // Read on the JS side: the worklets get plain strings.
  const current = colors.primarySoft;
  const pick = colors.xpSoft;
  const read = colors.primary;
  const ink = colors.text;
  const boxStyle = useAnimatedStyle(() => {
    const p = pos.value;
    return {
      backgroundColor:
        selected.value === index ? pick : p >= index && p < index + 1 ? current : 'transparent',
    };
  });
  const labelStyle = useAnimatedStyle(() => ({
    color: selected.value === index || pos.value >= index + 1 ? read : ink,
  }));
  return (
    <Animated.View onLayout={onLayout} style={[styles.word, boxStyle]}>
      <Animated.Text style={[styles.wordText, labelStyle]}>{word}</Animated.Text>
    </Animated.View>
  );
}

const PLAYER = 60;
const RING = 4;
const RADIUS = (PLAYER - RING) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type PlayerIcon = 'play' | 'pause' | 'replay';
const PLAYER_ICONS = { play: Play, pause: Pause, replay: RotateCcw };

/** The reader's round audio button, its ring following `pos`. */
function DemoPlayer({ pos, icon }: { pos: SharedValue<number>; icon: PlayerIcon }) {
  const ringProps = useAnimatedProps(() => ({
    strokeDashoffset: CIRCUMFERENCE * (1 - Math.min(1, Math.max(0, pos.value) / WORDS)),
  }));
  return (
    <View style={styles.playerRow}>
      <View style={styles.player}>
        <Svg width={PLAYER} height={PLAYER} style={StyleSheet.absoluteFill}>
          <Circle
            cx={PLAYER / 2}
            cy={PLAYER / 2}
            r={RADIUS}
            stroke={colors.border}
            strokeWidth={RING}
            fill={colors.surface}
          />
          <AnimatedCircle
            cx={PLAYER / 2}
            cy={PLAYER / 2}
            r={RADIUS}
            stroke={colors.primary}
            strokeWidth={RING}
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            animatedProps={ringProps}
            fill="none"
            transform={`rotate(-90 ${PLAYER / 2} ${PLAYER / 2})`}
          />
        </Svg>
        <View style={styles.playerButton}>
          <Icon icon={PLAYER_ICONS[icon]} size={22} color={colors.textOnColor} />
        </View>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// The demos
// ---------------------------------------------------------------------------

type DemoProps = { active: boolean; gesture: PlayFromWord };

/** Translate: the hand touches a word, its translation slides up. */
export function TranslateDemo({ active, gesture: kind }: DemoProps) {
  const { t } = useI18n();
  const layouts = useLayouts();
  const hand = useHand();
  const pos = useSharedValue(-1);
  const selected = useSharedValue(-1);
  const sheet = useSharedValue(0);

  useLoop(
    active && layouts.ready,
    async (wait) => {
      placeHand(hand, layouts.rest());
      selected.set(-1);
      sheet.set(0);
      await wait(600);
      await moveHand(hand, layouts.word(LIGHTHOUSE), wait);
      await wait(250);
      await gesture(hand, kind, wait);
      selected.set(LIGHTHOUSE);
      sheet.set(withSpring(1, springs.pop));
      await wait(450);
      await leaveHand(hand, layouts.rest(), wait);
      await wait(1900);
      sheet.set(withTiming(0, { duration: 260 }));
      selected.set(-1);
      await wait(700);
    },
    () => {
      hand.shown.set(0);
      selected.set(-1);
      sheet.set(0);
    },
  );

  const sheetStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, sheet.value * 1.5),
    transform: [{ translateY: (1 - sheet.value) * 150 }],
  }));

  return (
    <DemoScreen layouts={layouts}>
      <DemoText layouts={layouts} pos={pos} selected={selected} />
      <Animated.View style={[styles.sheet, sheetStyle]}>
        <View style={styles.handle} />
        <View style={styles.sheetTitle}>
          <Text variant="heading">lighthouse</Text>
          <Icon icon={Volume2} size={20} color={colors.primary} />
        </View>
        <Text variant="bodyBold" color={colors.textSecondary}>
          {t.intro.sample.lighthouse}
        </Text>
        <View style={styles.added}>
          <Icon icon={Check} size={16} color={colors.successShade} />
          <Text variant="caption" color={colors.successShade}>
            {t.intro.added}
          </Text>
        </View>
      </Animated.View>
      <Hand hand={hand} />
    </DemoScreen>
  );
}

/** Listen: the hand starts the voice-over, the text lights up word by word; replay at the end. */
export function ListenDemo({ active }: { active: boolean }) {
  const layouts = useLayouts();
  const hand = useHand();
  const pos = useSharedValue(-1);
  const selected = useSharedValue(-1);
  const [icon, setIcon] = useState<PlayerIcon>('play');

  useLoop(
    active && layouts.ready,
    async (wait) => {
      placeHand(hand, layouts.rest());
      await wait(600);
      await moveHand(hand, layouts.player(), wait);
      await wait(200);
      await touch(hand, wait);
      setIcon('pause');
      pos.set(0);
      pos.set(withTiming(WORDS, { duration: WORDS * WORD_MS, easing: Easing.linear }));
      await leaveHand(hand, layouts.rest(), wait);
      await wait(WORDS * WORD_MS - MOVE_MS);
      // The end: the button now starts it over (what the next round shows).
      setIcon('replay');
      await wait(1300);
    },
    () => {
      hand.shown.set(0);
      cancelAnimation(pos);
      pos.set(-1);
      setIcon('play');
    },
  );

  return (
    <DemoScreen layouts={layouts}>
      <DemoText layouts={layouts} pos={pos} selected={selected} />
      <DemoPlayer pos={pos} icon={icon} />
      <Hand hand={hand} />
    </DemoScreen>
  );
}

/** Restart from a word: while it plays, the hand touches an earlier word, the voice goes back. */
export function RestartDemo({ active, gesture: kind }: DemoProps) {
  const layouts = useLayouts();
  const hand = useHand();
  const pos = useSharedValue(-1);
  const selected = useSharedValue(-1);
  const [icon, setIcon] = useState<PlayerIcon>('play');

  useLoop(
    active && layouts.ready,
    async (wait) => {
      placeHand(hand, layouts.rest());
      cancelAnimation(pos);
      pos.set(-1);
      setIcon('play');
      await wait(700);
      setIcon('pause');
      pos.set(0);
      pos.set(withTiming(WORDS, { duration: WORDS * WORD_MS, easing: Easing.linear }));
      await wait(3 * WORD_MS);
      await moveHand(hand, layouts.word(KEEPER), wait);
      await wait(150);
      await gesture(hand, kind, wait);
      // Back to the touched word, and on from there.
      cancelAnimation(pos);
      pos.set(KEEPER);
      pos.set(withTiming(WORDS, { duration: (WORDS - KEEPER) * WORD_MS, easing: Easing.linear }));
      await wait(300);
      await leaveHand(hand, layouts.rest(), wait);
      await wait((WORDS - KEEPER) * WORD_MS - 300 - MOVE_MS);
      setIcon('replay');
      await wait(1200);
    },
    () => {
      hand.shown.set(0);
      cancelAnimation(pos);
      pos.set(-1);
      setIcon('play');
    },
  );

  return (
    <DemoScreen layouts={layouts}>
      <DemoText layouts={layouts} pos={pos} selected={selected} />
      <DemoPlayer pos={pos} icon={icon} />
      <Hand hand={hand} />
    </DemoScreen>
  );
}

const CARDS = [LIGHTHOUSE, KEEPER, OLD] as const;
const CARD_KEYS = { [LIGHTHOUSE]: 'lighthouse', [KEEPER]: 'keeper', [OLD]: 'old' } as const;

/** Review: the words come back as cards; the hand turns one over to check the translation. */
export function ReviewDemo({ active }: { active: boolean }) {
  const { t } = useI18n();
  const layouts = useLayouts();
  const hand = useHand();
  const [card, setCard] = useState(0);
  const [back, setBack] = useState(false);
  const slide = useSharedValue(0);
  const flip = useSharedValue(1);
  const round = useRef(0);
  // Where the card stands (centered in its area, above the bottom padding).
  const area = useRef<LayoutRectangle | null>(null);

  useLoop(
    active,
    async (wait) => {
      const i = round.current++ % CARDS.length;
      placeHand(hand, layouts.rest());
      setCard(i);
      setBack(false);
      slide.set(1);
      slide.set(withTiming(0, { duration: 420, easing: Easing.out(Easing.cubic) }));
      await wait(1100);
      const box = area.current;
      if (box) {
        const center = { x: box.x + box.width / 2, y: box.y + (box.height - spacing.xl) / 2 + 10 };
        await moveHand(hand, center, wait);
      }
      await touch(hand, wait);
      // Turned over: squeezed to an edge, the other face, opened again.
      flip.set(withTiming(0, { duration: 160 }));
      await wait(160);
      setBack(true);
      flip.set(withTiming(1, { duration: 180 }));
      await leaveHand(hand, layouts.rest(), wait);
      await wait(1300);
      slide.set(withTiming(-1, { duration: 360, easing: Easing.in(Easing.cubic) }));
      await wait(380);
    },
    () => {
      hand.shown.set(0);
      slide.set(0);
      flip.set(1);
      setBack(false);
    },
  );

  const cardStyle = useAnimatedStyle(() => ({
    opacity: 1 - Math.abs(slide.value),
    transform: [
      { translateX: slide.value * 220 },
      { rotate: `${slide.value * -8}deg` },
      { scaleX: flip.value },
    ],
  }));

  const word = CARDS[card]!;
  const key = CARD_KEYS[word];
  return (
    <DemoScreen layouts={layouts}>
      <View style={styles.reviewTop}>
        <ProgressBar progress={(card + 1) / CARDS.length} height={10} style={styles.flex} />
      </View>
      <View
        style={styles.cardArea}
        onLayout={(e) => {
          area.current = e.nativeEvent.layout;
        }}>
        <Animated.View style={[styles.card, back && styles.cardBack, cardStyle]}>
          {back ? (
            <>
              <Text variant="caption" color={colors.textSecondary}>
                {key}
              </Text>
              <Text variant="title" color={colors.primary}>
                {t.intro.sample[key]}
              </Text>
            </>
          ) : (
            <>
              <Icon icon={Volume2} size={22} color={colors.primary} />
              <Text variant="title">{key}</Text>
            </>
          )}
        </Animated.View>
      </View>
      <Hand hand={hand} />
    </DemoScreen>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    flex: { flex: 1 },
    screen: {
      height: DEMO_HEIGHT,
      borderRadius: radii.xl,
      borderWidth: 2,
      borderColor: colors.border,
      borderBottomWidth: 5,
      backgroundColor: colors.surface,
      overflow: 'hidden',
    },
    text: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      rowGap: spacing.xs,
      padding: spacing.lg,
      paddingTop: spacing.xl,
    },
    word: { borderRadius: radii.sm, paddingHorizontal: 4, marginRight: 2 },
    wordText: { fontFamily: fonts.regular, fontSize: 21, lineHeight: 32 },
    playerRow: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: spacing.lg,
      alignItems: 'center',
    },
    player: { width: PLAYER, height: PLAYER, alignItems: 'center', justifyContent: 'center' },
    playerButton: {
      width: PLAYER - RING * 2 - 4,
      height: PLAYER - RING * 2 - 4,
      borderRadius: PLAYER,
      backgroundColor: colors.primary,
      borderBottomWidth: 4,
      borderBottomColor: colors.primaryShade,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sheet: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      gap: spacing.xs,
      padding: spacing.lg,
      paddingTop: spacing.sm,
      borderTopLeftRadius: radii.lg,
      borderTopRightRadius: radii.lg,
      borderTopWidth: 2,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      boxShadow: '0 -6px 18px rgba(37,34,58,0.12)',
    },
    handle: {
      alignSelf: 'center',
      width: 36,
      height: 4,
      borderRadius: radii.pill,
      backgroundColor: colors.border,
      marginBottom: spacing.xs,
    },
    sheetTitle: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    added: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.xs },
    reviewTop: { flexDirection: 'row', padding: spacing.lg },
    cardArea: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingBottom: spacing.xl,
    },
    card: {
      width: 200,
      height: 150,
      borderRadius: radii.lg,
      borderWidth: 2,
      borderBottomWidth: 5,
      borderColor: colors.border,
      backgroundColor: colors.background,
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
    },
    cardBack: { backgroundColor: colors.primarySoft, borderColor: colors.primarySoft },
    hand: { position: 'absolute', left: 0, top: 0, width: HAND, height: HAND },
    ripple: {
      position: 'absolute',
      left: 0,
      top: 0,
      width: RIPPLE,
      height: RIPPLE,
      borderRadius: RIPPLE / 2,
      backgroundColor: colors.primary,
    },
  }),
);
