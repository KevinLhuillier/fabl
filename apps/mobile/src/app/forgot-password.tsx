import { router, useLocalSearchParams } from 'expo-router';
import { Hash, KeyRound, LockKeyhole, Mail } from 'lucide-react-native';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useI18n } from '@/i18n';
import { authErrorMessage } from '@/lib/auth';
import { resetPassword, sendResetCode } from '@/lib/passwordReset';
import {
  Button,
  Card,
  IconBubble,
  Text,
  TextField,
  colors,
  enter,
  haptics,
  spacing,
} from '@/theme';

/**
 * Forgotten password: an emailed code, then a new password. Once saved, the app
 * signs in with it and the guard in `_layout` opens the stories.
 */
export default function ForgotPassword() {
  const { t } = useI18n();
  const params = useLocalSearchParams<{ email?: string }>();
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState(params.email ?? '');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<void>) {
    setError(null);
    setLoading(true);
    try {
      await action();
    } catch (e) {
      haptics.error();
      setError(authErrorMessage(t, e instanceof Error ? e.message : String(e)));
    } finally {
      setLoading(false);
    }
  }

  const sendCode = () =>
    run(async () => {
      await sendResetCode(email.trim());
      setStep('code');
    });

  const confirm = () => run(() => resetPassword(email.trim(), code.trim(), password));

  const canSend = email.includes('@');
  // Supabase codes have 6 digits by default (up to 10 depending on the project).
  const canConfirm = /^\d{6,10}$/.test(code.trim()) && password.length >= 6;

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.safe}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Animated.View entering={enter.up()} style={styles.hero}>
            <IconBubble icon={LockKeyhole} />
            <Text variant="title" align="center">
              {t.forgotPassword.title}
            </Text>
            <Text align="center" color={colors.textSecondary}>
              {step === 'email' ? t.forgotPassword.hint : t.forgotPassword.codeSent(email.trim())}
            </Text>
          </Animated.View>

          <Animated.View entering={enter.up(100)}>
            <Card padding={spacing.xl}>
              {step === 'email' ? (
                <View style={styles.form}>
                  <TextField
                    icon={Mail}
                    placeholder={t.signIn.email}
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    autoComplete="email"
                    keyboardType="email-address"
                    textContentType="emailAddress"
                    onSubmitEditing={() => canSend && sendCode()}
                  />
                  {error ? <Text color={colors.danger}>{error}</Text> : null}
                  <Button
                    label={t.forgotPassword.sendCode}
                    onPress={sendCode}
                    loading={loading}
                    disabled={!canSend}
                  />
                </View>
              ) : (
                <View style={styles.form}>
                  <TextField
                    icon={Hash}
                    placeholder={t.forgotPassword.code}
                    value={code}
                    onChangeText={setCode}
                    keyboardType="number-pad"
                    autoComplete="one-time-code"
                    textContentType="oneTimeCode"
                    maxLength={10}
                  />
                  <TextField
                    icon={KeyRound}
                    placeholder={t.forgotPassword.newPassword}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    autoComplete="new-password"
                    textContentType="newPassword"
                    onSubmitEditing={() => canConfirm && confirm()}
                  />
                  {error ? <Text color={colors.danger}>{error}</Text> : null}
                  <Button
                    label={t.forgotPassword.confirm}
                    onPress={confirm}
                    loading={loading}
                    disabled={!canConfirm}
                  />
                  <Button
                    variant="ghost"
                    haptic="tap"
                    label={t.forgotPassword.resend}
                    sentence
                    disabled={loading}
                    onPress={sendCode}
                  />
                </View>
              )}
            </Card>
          </Animated.View>

          <Button
            variant="ghost"
            haptic="tap"
            label={t.common.back}
            sentence
            onPress={() => router.back()}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, justifyContent: 'center', padding: spacing.xl, gap: spacing.xl },
  hero: { alignItems: 'center', gap: spacing.sm },
  form: { gap: spacing.lg },
});
