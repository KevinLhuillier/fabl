import { Play } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { useI18n } from '@/i18n';
import type { ResumePoint } from '@/lib/api/progress';
import { Card, Icon, ProgressBar, Text, colors, levelColors, spacing } from '@/theme';

import { StoryCover } from './StoryCover';

type Props = {
  resume: ResumePoint;
  /** 0 → 1, share of the story's pages read. */
  fraction: number;
  onPress: () => void;
};

/** Home shortcut back into the story read last, at the chapter and page left. */
export function ContinueReading({ resume, fraction, onPress }: Props) {
  const { t } = useI18n();
  const { story, chapter, pageIndex } = resume;
  const c = levelColors[story.level];
  const n = chapter.position + 1;
  const page = Math.min(pageIndex + 1, chapter.pageCount);

  return (
    <Card tint={{ face: c.soft, edge: c.solid }} onPress={onPress}>
      <View
        style={styles.row}
        accessibilityRole="button"
        accessibilityLabel={t.home.continueA11y(story.title, n, page, chapter.pageCount)}>
        <StoryCover story={story} width={56} />
        <View style={styles.flex}>
          <Text variant="caption" color={c.shade}>
            {t.home.continueReading.toUpperCase()}
          </Text>
          <Text variant="bodyBold" numberOfLines={1}>
            {story.title}
          </Text>
          <Text variant="caption" color={colors.textSecondary} numberOfLines={1}>
            {t.home.continueChapter(n, chapter.title, page, chapter.pageCount)}
          </Text>
          <ProgressBar progress={fraction} color={c.solid} height={8} style={styles.bar} />
        </View>
        <View style={[styles.play, { backgroundColor: c.solid }]}>
          <Icon icon={Play} size={22} color={colors.textOnColor} />
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1, gap: 2 },
  bar: { marginTop: spacing.sm },
  play: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    // Optical centering of the triangle.
    paddingLeft: 3,
  },
});
