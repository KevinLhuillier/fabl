import { useMemo, useRef } from 'react';
import {
  FlatList,
  StyleSheet,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import { useI18n } from '@/i18n';
import type { StoryProgressSummary } from '@/lib/api/progress';
import type { StorySummary } from '@/lib/types';
import { Badge, Text, colors, spacing, type CefrLevel } from '@/theme';

import { StoryTile } from './StoryTile';

/** Space between two books of a shelf. */
const GAP = spacing.lg;
/** Books in view at once: the last one peeks out, telling the row scrolls. */
const IN_VIEW = 2.4;
/**
 * Endless row: the books are repeated this many times and the row starts on the middle copy.
 * Whenever it stops away from it, it jumps (unseen) to the same book in the middle copy, so
 * a fling can never reach either end.
 */
const COPIES = 7;
const MIDDLE = Math.floor(COPIES / 2);

type Props = {
  title: string;
  /** Level shelf: its badge before the title. */
  level?: CefrLevel;
  /** In display order. */
  stories: StorySummary[];
  /** Endless row (the books repeat); off for a list whose order matters. */
  loop?: boolean;
  progress: Map<string, StoryProgressSummary>;
  onOpen: (story: StorySummary) => void;
};

/** A row of books scrolled sideways (endless with `loop`): a level, the stories in progress… */
export function StoryShelf({
  title,
  level,
  stories,
  loop: loopable = false,
  progress,
  onOpen,
}: Props) {
  const { t } = useI18n();
  const { width } = useWindowDimensions();
  const listRef = useRef<FlatList<{ key: string; story: StorySummary }>>(null);
  // The row runs to the screen edge; the page's side margin stays before the first book.
  const tileWidth = Math.round((width - spacing.xl) / IN_VIEW - GAP);
  const step = tileWidth + GAP;
  const n = stories.length;
  // A single book has nothing to loop over.
  const loop = loopable && n > 1;

  const items = useMemo(
    () =>
      Array.from({ length: loop ? COPIES : 1 }, (_, copy) =>
        stories.map((story) => ({ key: `${copy}-${story.id}`, story })),
      ).flat(),
    [stories, loop],
  );

  /** Back to the middle copy, on the same book. */
  function recenter(e: NativeSyntheticEvent<NativeScrollEvent>) {
    if (!loop) return;
    const index = Math.round(e.nativeEvent.contentOffset.x / step);
    if (Math.floor(index / n) === MIDDLE) return;
    const target = MIDDLE * n + (((index % n) + n) % n);
    listRef.current?.scrollToOffset({ offset: target * step, animated: false });
  }

  return (
    <View style={styles.shelf}>
      <View style={styles.header}>
        {level ? <Badge label={level} level={level} solid /> : null}
        <Text variant="heading" style={styles.flex} numberOfLines={1}>
          {title}
        </Text>
        <Text variant="caption" color={colors.textSecondary}>
          {t.home.storyCount(n)}
        </Text>
      </View>
      <FlatList
        ref={listRef}
        horizontal
        data={items}
        keyExtractor={(item) => item.key}
        getItemLayout={(_, index) => ({ length: step, offset: step * index, index })}
        initialScrollIndex={loop ? MIDDLE * n : 0}
        // Every book stays mounted (a few dozen at most): a virtualized row would mount
        // books as they come into view, and the jump back to the middle copy would land on
        // fresh covers fading in — a flash.
        initialNumToRender={items.length}
        windowSize={COPIES * 2 + 1}
        removeClippedSubviews={false}
        showsHorizontalScrollIndicator={false}
        snapToInterval={step}
        decelerationRate="fast"
        onMomentumScrollEnd={recenter}
        style={styles.list}
        contentContainerStyle={styles.row}
        renderItem={({ item }) => (
          <View style={{ width: tileWidth, marginRight: GAP }}>
            <StoryTile
              story={item.story}
              progress={progress.get(item.story.id)}
              onPress={() => onOpen(item.story)}
            />
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  shelf: { gap: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
  // Bleeds over the page's side margins, so the books slide in from the screen edges.
  list: { marginHorizontal: -spacing.xl },
  row: { paddingHorizontal: spacing.xl },
});
