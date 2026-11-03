import { useRouter } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import {
  StyleSheet,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import Animated, {
  interpolate,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ListenDemo, RestartDemo, ReviewDemo, TranslateDemo } from '@/components/IntroDemos';
import { useI18n } from '@/i18n';
import { useIntro } from '@/lib/intro';
import { REMINDERS_SUPPORTED, useReminders } from '@/lib/reminders';
import { useStats } from '@/lib/stats';
import { Button, colors, haptics, radii, spacing, Text, themed } from '@/theme';

type Slide = { key: string; title: string; text: string; hint?: string; demo: ReactNode };

/**
 * The demo: slides where a hand shows the reader's gestures. Shown once after the
 * username (the guard in `_layout` then moves on to the reminders); "Revoir la démo"
 * in the profile opens it again, and closing it goes back there.
 */
export default function IntroScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const { stats } = useStats();
  const { seen, markSeen } = useIntro();
  const { prefs: reminders } = useReminders();
  // Shown as an onboarding step (not seen yet when opened), or again from the profile.
  const [firstTime] = useState(!seen);
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollX = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollX.value = e.contentOffset.x;
  });

  // The gestures as this account has them (they can be swapped in the reading settings).
  const play = stats?.play_from_word ?? 'double_tap';
  const translate = play === 'tap' ? 'double_tap' : 'tap';
  const i = t.intro;
  const slides: Slide[] = [
    {
      key: 'translate',
      title: i.translateTitle,
      text: i.translateText(i.gesture[translate]),
      demo: <TranslateDemo active={index === 0} gesture={translate} />,
    },
    {
      key: 'listen',
      title: i.listenTitle,
      text: i.listenText,
      demo: <ListenDemo active={index === 1} />,
    },
    {
      key: 'restart',
      title: i.restartTitle,
      text: i.restartText(i.gesture[play]),
      hint: i.gestureHint,
      demo: <RestartDemo active={index === 2} gesture={play} />,
    },
    {
      key: 'review',
      title: i.reviewTitle,
      text: i.reviewText,
      demo: <ReviewDemo active={index === 3} />,
    },
  ];
  const last = index === slides.length - 1;

  // First time: saved as seen. When the reminders come next, the guard in `_layout` opens
  // them; otherwise the screen stays reachable, so it moves on to the app itself.
  const remindersNext = REMINDERS_SUPPORTED && !reminders.asked;
  useEffect(() => {
    if (firstTime && seen && !remindersNext) router.replace('/');
  }, [firstTime, seen, remindersNext, router]);

  // Opened again from the profile: back there.
  const finish = () => {
    if (firstTime) markSeen();
    else if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  const goTo = (to: number) => {
    setIndex(to);
    scrollRef.current?.scrollTo({ x: to * width, animated: true });
  };

  const onSettle = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const to = Math.round(e.nativeEvent.contentOffset.x / width);
    if (to !== index) {
      haptics.select();
      setIndex(to);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.top}>
        <Button
          label={i.skip}
          variant="ghost"
          haptic="tap"
          sentence
          compact
          style={last ? styles.hidden : undefined}
          disabled={last}
          onPress={finish}
        />
      </View>

      <Animated.ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onMomentumScrollEnd={onSettle}
        style={styles.flex}>
        {slides.map((slide, n) => (
          <View key={slide.key} style={[styles.slide, { width }]}>
            <SlideText scrollX={scrollX} width={width} index={n} offset={-1}>
              {slide.demo}
            </SlideText>
            <SlideText scrollX={scrollX} width={width} index={n} offset={1}>
              <View style={styles.texts}>
                <Text variant="title" align="center">
                  {slide.title}
                </Text>
                <Text align="center" color={colors.textSecondary}>
                  {slide.text}
                </Text>
                {slide.hint ? (
                  <Text variant="caption" align="center" color={colors.textMuted}>
                    {slide.hint}
                  </Text>
                ) : null}
              </View>
            </SlideText>
          </View>
        ))}
      </Animated.ScrollView>

      <View style={styles.bottom}>
        <View style={styles.dots}>
          {slides.map((slide, n) => (
            <Dot key={slide.key} scrollX={scrollX} width={width} index={n} />
          ))}
        </View>
        <Button
          label={last ? i.start : i.next}
          onPress={() => (last ? finish() : goTo(index + 1))}
        />
      </View>
    </SafeAreaView>
  );
}

/** Parallax while swiping: the demo and the text drift at different speeds and fade. */
function SlideText({
  scrollX,
  width,
  index,
  offset,
  children,
}: {
  scrollX: SharedValue<number>;
  width: number;
  index: number;
  /** Direction and strength of the drift. */
  offset: number;
  children: ReactNode;
}) {
  const style = useAnimatedStyle(() => {
    const p = scrollX.value / width - index;
    return {
      opacity: interpolate(p, [-1, 0, 1], [0, 1, 0], 'clamp'),
      transform: [
        { translateX: interpolate(p, [-1, 0, 1], [-80 * offset, 0, 80 * offset], 'clamp') },
        { scale: interpolate(p, [-1, 0, 1], [0.92, 1, 0.92], 'clamp') },
      ],
    };
  });
  return <Animated.View style={style}>{children}</Animated.View>;
}

function Dot({
  scrollX,
  width,
  index,
}: {
  scrollX: SharedValue<number>;
  width: number;
  index: number;
}) {
  const on = colors.primary;
  const off = colors.border;
  const style = useAnimatedStyle(() => {
    const d = Math.min(1, Math.abs(scrollX.value / width - index));
    return { width: 10 + 18 * (1 - d), backgroundColor: d < 0.5 ? on : off };
  });
  return <Animated.View style={[styles.dot, style]} />;
}

const styles = themed(() =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    flex: { flex: 1 },
    top: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: spacing.lg },
    hidden: { opacity: 0 },
    slide: {
      flex: 1,
      justifyContent: 'center',
      paddingHorizontal: spacing.xl,
      gap: spacing.xxl,
    },
    texts: { gap: spacing.sm },
    bottom: { padding: spacing.xl, paddingTop: spacing.md, gap: spacing.xl },
    dots: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm },
    dot: { height: 10, borderRadius: radii.pill },
  }),
);
