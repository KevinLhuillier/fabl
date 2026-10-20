import { Check, Languages } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LANGS, LANG_NAMES, MESSAGES, useI18n, type Lang } from '@/i18n';
import { Button, Card, Icon, IconBubble, Text, colors, enter, spacing } from '@/theme';

/**
 * First sign-in: the user picks the language of the app and of the word
 * translations. Saving it on the account lets the guard in `_layout` open the app.
 */
export default function LanguageScreen() {
  const { lang, setLang } = useI18n();
  // Preselected: the device language. The screen previews the selected one.
  const [selected, setSelected] = useState<Lang>(lang);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const t = MESSAGES[selected];

  async function confirm() {
    setSaving(true);
    setError(null);
    try {
      await setLang(selected);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Animated.View entering={enter.up()} style={styles.hero}>
          <IconBubble icon={Languages} />
          <Text variant="title" align="center">
            {t.language.title}
          </Text>
          <Text align="center" color={colors.textSecondary}>
            {t.language.hint}
          </Text>
        </Animated.View>

        <View style={styles.options}>
          {LANGS.map((l, i) => {
            const active = l === selected;
            return (
              <Animated.View key={l} entering={enter.up(100 + i * 50)}>
                <Card
                  onPress={() => setSelected(l)}
                  tint={active ? { face: colors.primarySoft, edge: colors.primary } : undefined}>
                  <View style={styles.option}>
                    <Text variant="heading" color={active ? colors.primary : colors.text}>
                      {LANG_NAMES[l]}
                    </Text>
                    {active ? <Icon icon={Check} size={22} color={colors.primary} /> : null}
                  </View>
                </Card>
              </Animated.View>
            );
          })}
        </View>

        {error ? <Text color={colors.danger}>{error}</Text> : null}
        <Button label={t.common.continue} loading={saving} onPress={confirm} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, justifyContent: 'center', padding: spacing.xl, gap: spacing.xl },
  hero: { gap: spacing.sm },
  options: { gap: spacing.md },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 32,
  },
});
