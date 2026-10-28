import { useRouter, useFocusEffect } from 'expo-router';
import { BookOpen, Brain, Crown, Search, Sparkles, Trash2 } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import Animated, { LinearTransition } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ConfirmSheet } from '@/components/ConfirmSheet';
import { SpeakButton } from '@/components/SpeakButton';
import { useI18n } from '@/i18n';
import { fetchVocabulary, removeFromVocabulary } from '@/lib/api/vocabulary';
import { endOfToday } from '@/lib/dates';
import { posLabel } from '@/lib/labels';
import { FREE_WORD_LIMIT, usePremium } from '@/lib/premium';
import { loadPronunciations } from '@/lib/pronunciation';
import { useTour } from '@/lib/tour';
import type { VocabularyItem } from '@/lib/types';
import {
  Badge,
  Button,
  Card,
  Icon,
  Loader,
  ProgressBar,
  Text,
  TextField,
  colors,
  enter,
  exit,
  haptics,
  spacing,
} from '@/theme';

/** Removes accents so "ecole" matches "école". */
const normalize = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export default function Vocabulary() {
  const router = useRouter();
  const { t, lang } = useI18n();
  const { premium, ready: premiumReady } = usePremium();
  const [items, setItems] = useState<VocabularyItem[] | null>(null);
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  /** Word waiting for the user's confirmation before removal. */
  const [toRemove, setToRemove] = useState<VocabularyItem | null>(null);
  // Kept separate from `toRemove` so the text stays during the closing fade.
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { target } = useTour('vocabulary', items !== null);

  useFocusEffect(
    useCallback(() => {
      fetchVocabulary(lang)
        .then(async (v) => {
          // All the cards' speakers at once, rather than one request per card.
          await loadPronunciations(v.map((i) => i.word)).catch((e: unknown) =>
            console.warn('pronunciations', e),
          );
          setItems(v);
          setError(null);
        })
        .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
    }, [lang]),
  );

  /** Asks for confirmation, then removes the word (and its review history). */
  /** Removes the confirmed word (and its review history); restores it on failure. */
  function remove(item: VocabularyItem) {
    setConfirmOpen(false);
    setItems((prev) => prev?.filter((i) => i.lemmaId !== item.lemmaId) ?? prev);
    removeFromVocabulary(item.lemmaId).catch((e: unknown) => {
      setError(e instanceof Error ? e.message : String(e));
      setItems((prev) => (prev ? [item, ...prev] : prev));
    });
  }

  const dueLimit = endOfToday().getTime();
  const dueCount = items?.filter((i) => new Date(i.dueAt).getTime() <= dueLimit).length ?? 0;

  const q = normalize(query.trim());
  const filtered =
    items && q
      ? items.filter(
          (i) => normalize(i.word).includes(q) || normalize(i.translation ?? '').includes(q),
        )
      : (items ?? []);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <FlatList
        data={filtered}
        keyExtractor={(i) => String(i.lemmaId)}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View style={styles.header}>
            <Text variant="title">{t.vocabulary.title}</Text>
            <View ref={target('review')} collapsable={false}>
              <Card tint={{ face: colors.primarySoft, edge: colors.primary }}>
                <View style={styles.reviewRow}>
                  <Icon icon={dueCount ? Brain : Sparkles} size={28} color={colors.primary} />
                  <View style={styles.flex}>
                    <Text variant="heading">
                      {dueCount ? t.vocabulary.toReview(dueCount) : t.vocabulary.allReviewed}
                    </Text>
                    <Text color={colors.textSecondary}>
                      {items ? t.vocabulary.learned(items.length) : '…'}
                    </Text>
                  </View>
                  <Button
                    label={dueCount ? t.vocabulary.review : t.vocabulary.practice}
                    disabled={!items?.length}
                    onPress={() => router.push('/review')}
                  />
                </View>
              </Card>
            </View>
            {items && premiumReady && !premium ? <WordLimit count={items.length} /> : null}
            <View ref={target('search')} collapsable={false}>
              <TextField
                icon={Search}
                placeholder={t.vocabulary.search}
                value={query}
                onChangeText={setQuery}
                autoCapitalize="none"
                autoCorrect={false}
                clearButtonMode="while-editing"
              />
            </View>
            {error ? <Text color={colors.danger}>{error}</Text> : null}
          </View>
        }
        ListEmptyComponent={
          items === null ? (
            <Loader icon={BookOpen} message={t.loading.words} />
          ) : (
            <Text align="center" color={colors.textSecondary} style={styles.empty}>
              {query ? t.vocabulary.noMatch : t.vocabulary.empty}
            </Text>
          )
        }
        renderItem={({ item, index }) => (
          <Animated.View
            entering={enter.up(Math.min(index, 8) * 30)}
            exiting={exit.fade()}
            layout={LinearTransition.duration(220)}>
            <WordCard
              item={item}
              due={new Date(item.dueAt).getTime() <= dueLimit}
              onRemove={() => {
                haptics.tap();
                setToRemove(item);
                setConfirmOpen(true);
              }}
            />
          </Animated.View>
        )}
      />
      <ConfirmSheet
        visible={confirmOpen}
        icon={Trash2}
        tone="danger"
        title={t.vocabulary.removeTitle}
        message={toRemove ? t.vocabulary.removeMessage(toRemove.word) : ''}
        confirmLabel={t.vocabulary.remove}
        onConfirm={() => toRemove && remove(toRemove)}
        onCancel={() => setConfirmOpen(false)}
      />
    </SafeAreaView>
  );
}

/** Free account: words used out of FREE_WORD_LIMIT, and the way to more. */
function WordLimit({ count }: { count: number }) {
  const router = useRouter();
  const { t } = useI18n();
  const full = count >= FREE_WORD_LIMIT;
  return (
    <Card onPress={() => router.push('/paywall')} padding={spacing.md}>
      <View style={styles.limitRow}>
        <Icon icon={Crown} size={22} color={colors.xpShade} />
        <View style={styles.limitBody}>
          <View style={styles.limitTop}>
            <Text variant="bodyBold">{t.premium.freePlan}</Text>
            <Text variant="caption" color={full ? colors.danger : colors.textSecondary}>
              {t.premium.wordsUsed(Math.min(count, FREE_WORD_LIMIT), FREE_WORD_LIMIT)}
            </Text>
          </View>
          <ProgressBar
            progress={count / FREE_WORD_LIMIT}
            color={full ? colors.danger : colors.xp}
            height={8}
          />
          <Text variant="caption" color={full ? colors.danger : colors.xpShade}>
            {full ? t.premium.limitReached : t.premium.upgrade}
          </Text>
        </View>
      </View>
    </Card>
  );
}

function WordCard({
  item,
  due,
  onRemove,
}: {
  item: VocabularyItem;
  due: boolean;
  onRemove: () => void;
}) {
  const { t } = useI18n();
  return (
    <Card>
      <View style={styles.cardTop}>
        {/* Takes the remaining width and wraps, so a long word never pushes the badge and bin out. */}
        <View style={styles.wordGroup}>
          <Text variant="heading" style={styles.word}>
            {item.word}
          </Text>
          <SpeakButton texts={[item.word]} size={32} />
          <Text variant="caption" color={colors.textMuted}>
            {posLabel(t, item.pos)}
          </Text>
        </View>
        {/* Lined up with the first line of the word, even when it wraps. */}
        <View style={styles.actions}>
          {due ? <Badge label={t.vocabulary.due} tone="primary" style={styles.badge} /> : null}
          <Pressable
            onPress={onRemove}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={t.vocabulary.removeA11y(item.word)}
            style={styles.remove}>
            <Icon icon={Trash2} size={18} color={colors.textMuted} />
          </Pressable>
        </View>
      </View>
      <Text variant="bodyBold" color={colors.primary}>
        {item.translation ?? '—'}
      </Text>
      {item.contextSentence ? (
        <Text color={colors.textSecondary} style={styles.context}>
          {t.review.quote(item.contextSentence)}
        </Text>
      ) : null}
      {item.storyTitle ? (
        <View style={styles.story}>
          <Icon icon={BookOpen} size={14} color={colors.textMuted} />
          <Text variant="caption" color={colors.textMuted}>
            {item.storyTitle}
          </Text>
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.xl, gap: spacing.md, paddingBottom: spacing.xxxl },
  header: { gap: spacing.lg, marginBottom: spacing.sm },
  reviewRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1 },
  empty: { marginTop: spacing.xl },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  // Height of the word's first line (the speaker button), so the bin stays level with it.
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 32 },
  // The badge sticks to the top of its row by default.
  badge: { alignSelf: 'center' },
  wordGroup: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
  },
  word: { flexShrink: 1 },
  remove: { padding: spacing.xs },
  limitRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  limitBody: { flex: 1, gap: spacing.xs },
  limitTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  context: { marginTop: spacing.sm, fontStyle: 'italic' },
  story: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.sm },
});
