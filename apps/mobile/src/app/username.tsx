import { AtSign } from 'lucide-react-native';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useI18n } from '@/i18n';
import { authErrorMessage } from '@/lib/auth';
import { useStats } from '@/lib/stats';
import { isValidUsername } from '@/lib/username';
import { Button, IconBubble, Text, TextField, colors, enter, haptics, spacing } from '@/theme';

/**
 * Accounts created before usernames choose one at their next launch. Saving it
 * on the account lets the guard in `_layout` open the app.
 */
export default function UsernameScreen() {
  const { t } = useI18n();
  const { updateUsername } = useStats();
  const [username, setUsername] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid = isValidUsername(username);

  async function confirm() {
    setSaving(true);
    setError(null);
    try {
      await updateUsername(username.trim());
    } catch (e) {
      haptics.error();
      setError(authErrorMessage(t, e instanceof Error ? e.message : String(e)));
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.safe}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Animated.View entering={enter.up()} style={styles.hero}>
            <IconBubble icon={AtSign} />
            <Text variant="title" align="center">
              {t.username.title}
            </Text>
            <Text align="center" color={colors.textSecondary}>
              {t.username.hint}
            </Text>
          </Animated.View>

          <Animated.View entering={enter.up(100)} style={styles.field}>
            <TextField
              icon={AtSign}
              placeholder={t.signIn.username}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="username-new"
              textContentType="username"
              maxLength={20}
              onSubmitEditing={() => valid && confirm()}
            />
            <Text variant="caption" color={colors.textSecondary}>
              {t.signIn.errors.invalidUsername}
            </Text>
          </Animated.View>

          {error ? <Text color={colors.danger}>{error}</Text> : null}
          <Button label={t.common.continue} loading={saving} disabled={!valid} onPress={confirm} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, justifyContent: 'center', padding: spacing.xl, gap: spacing.xl },
  hero: { gap: spacing.sm },
  field: { gap: spacing.xs },
});
