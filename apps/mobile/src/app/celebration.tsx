import { router, useLocalSearchParams } from 'expo-router';
import {
  BookCheck,
  BookOpen,
  Brain,
  Flame,
  Target,
  Trophy,
  Clock,
  type LucideIcon,
} from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Confetti } from '@/components/Confetti';
import { useI18n } from '@/i18n';
import { displayedStreak, goalSeconds } from '@/lib/gamification';
import { formatDuration } from '@/lib/labels';
import { useStats } from '@/lib/stats';
import {
  Badge,
  Button,
  Card,
  Icon,
  IconBubble,
  ProgressBar,
  Text,
  colors,
  enter,
  haptics,
  spacing,
} from '@/theme';

type Kind = 'chapter' | 'story' | 'review';

type Params = {
  kind?: Kind;
  /** Practice time counted on the screen just finished. */
  seconds?: string;
  title?: string;
  /** Chapter only: lets the user chain straight into the next chapter. */
  nextChapterId?: string;
  storyId?: string;
  /** Chapter and story: words of the chapter added to "Mes mots", not reviewed yet. */
  newWords?: string;
};

const HERO: Record<Kind, { icon: LucideIcon; color: string; background: string }> = {
  chapter: { icon: BookCheck, color: colors.successShade, background: colors.successSoft },
  story: { icon: Trophy, color: colors.xpShade, background: colors.xpSoft },
  review: { icon: Brain, color: colors.infoShade, background: colors.infoSoft },
};

/** Reward screen after a chapter, a whole story or a review session. */
export default function Celebration() {
  const {
    kind = 'story',
    seconds = '0',
    title,
    nextChapterId,
    storyId,
    newWords,
  } = useLocalSearchParams<Params>();
  const { stats, todaySeconds } = useStats();
  const { t } = useI18n();
  const spent = Number(seconds) || 0;
  const wordsToLearn = Number(newWords) || 0;
  const shownSeconds = useCountUp(spent);

  useEffect(() => {
    haptics.success();
  }, []);

  const goal = goalSeconds(stats);
  const reached = todaySeconds >= goal;
  const streak = stats ? displayedStreak(stats) : 0;

  return (
    <SafeAreaView style={styles.safe}>
      <Confetti />
      <View style={styles.content}>
        <Animated.View entering={enter.up()}>
          <IconBubble
            icon={HERO[kind].icon}
            diameter={120}
            color={HERO[kind].color}
            background={HERO[kind].background}
          />
        </Animated.View>
        <Animated.View entering={enter.up(120)} style={styles.titles}>
          <Text variant="display" align="center" color={colors.primary}>
            {t.celebration[kind]}
          </Text>
          {title ? (
            <Text variant="heading" align="center" color={colors.textSecondary}>
              {title}
            </Text>
          ) : null}
        </Animated.View>

        <Animated.View entering={enter.up(240)}>
          <Card tint={{ face: colors.xpSoft, edge: colors.xp }} padding={spacing.xl}>
            <View style={styles.timeRow}>
              <Icon icon={Clock} size={36} color={colors.xpShade} />
              <Text variant="display" color={colors.xpShade}>
                {formatDuration(shownSeconds)}
              </Text>
            </View>
            <Text align="center" color={colors.xpShade}>
              {kind === 'review' ? t.celebration.reviewTime : t.celebration.readingTime}
            </Text>
          </Card>
        </Animated.View>

        <Animated.View entering={enter.up(360)} style={styles.stats}>
          <View style={styles.row}>
            <Badge icon={Flame} label={t.celebration.streak(streak)} tone="streak" />
            <Badge icon={Clock} label={formatDuration(stats?.total_seconds ?? 0)} tone="xp" />
          </View>
          <Card>
            <View style={styles.goalTitle}>
              <Icon
                icon={Target}
                size={18}
                color={reached ? colors.successShade : colors.xpShade}
              />
              <Text variant="bodyBold">
                {reached
                  ? t.celebration.goalReached
                  : t.celebration.goalProgress(Math.floor(todaySeconds / 60), goal / 60)}
              </Text>
            </View>
            <ProgressBar
              progress={todaySeconds / goal}
              color={reached ? colors.success : colors.xp}
            />
          </Card>
          {wordsToLearn > 0 ? (
            <Card tint={{ face: colors.infoSoft, edge: colors.info }}>
              <View style={styles.wordsRow}>
                <Icon icon={BookOpen} size={22} color={colors.infoShade} />
                <View style={styles.flex}>
                  <Text variant="bodyBold" color={colors.infoShade}>
                    {t.celebration.newWords(wordsToLearn)}
                  </Text>
                  <Text variant="caption" color={colors.textSecondary}>
                    {t.celebration.newWordsHint}
                  </Text>
                </View>
              </View>
            </Card>
          ) : null}
        </Animated.View>
      </View>

      <Animated.View entering={enter.up(480)} style={styles.footer}>
        {nextChapterId && storyId ? (
          <Button
            label={t.celebration.nextChapter}
            variant="success"
            onPress={() =>
              router.replace({
                pathname: '/read/[chapterId]',
                params: { chapterId: nextChapterId, storyId },
              })
            }
          />
        ) : null}
        <Button
          label={nextChapterId ? t.celebration.later : t.common.continue}
          variant={nextChapterId ? 'secondary' : 'success'}
          onPress={() => router.back()}
        />
      </Animated.View>
    </SafeAreaView>
  );
}

/** Animates a number from 0 to `target` (~0.9 s). */
function useCountUp(target: number) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!target) return;
    const start = Date.now();
    const id = setInterval(() => {
      const t = Math.min(1, (Date.now() - start) / 900);
      setValue(Math.round(target * (1 - Math.pow(1 - t, 3))));
      if (t >= 1) clearInterval(id);
    }, 30);
    return () => clearInterval(id);
  }, [target]);
  return value;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1, justifyContent: 'center', padding: spacing.xl, gap: spacing.xl },
  titles: { gap: spacing.sm },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  stats: { gap: spacing.md },
  row: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm },
  goalTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  wordsRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1 },
  footer: { padding: spacing.xl, gap: spacing.md },
});
