import { Dumbbell, PartyPopper } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { useI18n } from '@/i18n';
import { Button, Card, Icon, Text, colors, enter, spacing } from '@/theme';

/** Result card under an exercise: "Bravo!" or "Almost!", details, then Continue. */
export function Feedback({
  passed,
  title,
  children,
  onContinue,
}: {
  passed: boolean;
  /** Replaces "Bravo!" / "Almost!". */
  title?: string;
  children?: ReactNode;
  onContinue: () => void;
}) {
  const { t } = useI18n();
  return (
    <Animated.View entering={enter.up()}>
      <Card
        tint={
          passed
            ? { face: colors.successSoft, edge: colors.success }
            : { face: colors.accentSoft, edge: colors.danger }
        }>
        <View style={styles.title}>
          <Icon
            icon={passed ? PartyPopper : Dumbbell}
            size={22}
            color={passed ? colors.successShade : colors.dangerShade}
          />
          <Text variant="heading" color={passed ? colors.successShade : colors.dangerShade}>
            {title ?? (passed ? t.review.right : t.review.almost)}
          </Text>
        </View>
        {children}
        <Button
          label={t.common.continue}
          variant={passed ? 'success' : 'danger'}
          style={styles.continue}
          onPress={onContinue}
        />
      </Card>
    </Animated.View>
  );
}

/** "word — translation", shown once answered so every exercise ends with the meaning. */
export function Meaning({ word, translation }: { word: string; translation: string | null }) {
  return (
    <Text>
      <Text variant="bodyBold">{word}</Text>
      {translation ? ` — ${translation}` : ''}
    </Text>
  );
}

const styles = StyleSheet.create({
  title: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  continue: { marginTop: spacing.md },
});
