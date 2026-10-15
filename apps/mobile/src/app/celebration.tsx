import { router, useLocalSearchParams } from 'expo-router';
import { BookCheck, Brain, Flame, Target, Trophy, Zap, type LucideIcon } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Confetti } from '@/components/Confetti';
import { displayedStreak } from '@/lib/gamification';
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
  xp?: string;
  title?: string;
  /** Chapter only: lets the user chain straight into the next chapter. */
  nextChapterId?: string;
  storyId?: string;
};

const HEADLINES: Record<Kind, string> = {
  chapter: 'Chapitre terminé !',
  story: 'Histoire terminée !',
  review: 'Révision terminée !',
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
    xp = '0',
    title,
    nextChapterId,
    storyId,
  } = useLocalSearchParams<Params>();
  const { stats, todayXp } = useStats();
  const gained = Number(xp) || 0;
  const shownXp = useCountUp(gained);

  useEffect(() => {
    haptics.success();
  }, []);

  const goal = stats?.daily_goal_xp ?? 30;
  const reached = todayXp >= goal;
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
            {HEADLINES[kind]}
          </Text>
          {title ? (
            <Text variant="heading" align="center" color={colors.textSecondary}>
              {title}
            </Text>
          ) : null}
        </Animated.View>

        <Animated.View entering={enter.up(240)}>
          <Card tint={{ face: colors.xpSoft, edge: colors.xp }} padding={spacing.xl}>
            <View style={styles.xpRow}>
              <Icon icon={Zap} size={36} color={colors.xpShade} />
              <Text variant="display" color={colors.xpShade}>
                +{shownXp} XP
              </Text>
            </View>
          </Card>
        </Animated.View>

        <Animated.View entering={enter.up(360)} style={styles.stats}>
          <View style={styles.row}>
            <Badge icon={Flame} label={`Série : ${streak} j`} tone="streak" />
            <Badge icon={Zap} label={`${stats?.total_xp ?? 0} XP`} tone="xp" />
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
                  ? 'Objectif du jour atteint !'
                  : `Objectif du jour : ${Math.min(todayXp, goal)} / ${goal} XP`}
              </Text>
            </View>
            <ProgressBar progress={todayXp / goal} color={reached ? colors.success : colors.xp} />
          </Card>
        </Animated.View>
      </View>

      <Animated.View entering={enter.up(480)} style={styles.footer}>
        {nextChapterId && storyId ? (
          <Button
            label="Chapitre suivant"
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
          label={nextChapterId ? 'Plus tard' : 'Continuer'}
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
  xpRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  stats: { gap: spacing.md },
  row: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm },
  goalTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  footer: { padding: spacing.xl, gap: spacing.md },
});
