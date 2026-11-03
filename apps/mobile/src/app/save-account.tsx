import { useRouter } from 'expo-router';
import { CloudUpload, Hash, KeyRound, Mail } from 'lucide-react-native';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useI18n } from '@/i18n';
import { authErrorMessage } from '@/lib/auth';
import { addGuestEmail, confirmGuestEmail, setGuestPassword } from '@/lib/guest';
import {
  Button,
  Card,
  colors,
  enter,
  haptics,
  IconBubble,
  spacing,
  Text,
  TextField,
  themed,
} from '@/theme';

/**
 * Turns the guest account into a normal one: an email (confirmed with an emailed code when
 * the project asks for it), then a password. Same account: progress and subscription stay.
 */
export default function SaveAccount() {
  const router = useRouter();
  const { t } = useI18n();
  const s = t.saveAccount;
  const [step, setStep] = useState<'form' | 'code' | 'done'>('form');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
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

  const finish = async () => {
    await setGuestPassword(password);
    haptics.success();
    setStep('done');
  };

  const submit = () =>
    run(async () => {
      if ((await addGuestEmail(email.trim())) === 'done') await finish();
      else setStep('code');
    });

  const confirm = () =>
    run(async () => {
      await confirmGuestEmail(email.trim(), code.trim());
      await finish();
    });

  const resend = () =>
    run(async () => {
      await addGuestEmail(email.trim());
    });

  const canSubmit = email.includes('@') && password.length >= 6;
  const canConfirm = /^\d{6,10}$/.test(code.trim());

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.safe}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Animated.View entering={enter.up()} style={styles.hero}>
            <IconBubble icon={CloudUpload} />
            <Text variant="title" align="center">
              {s.title}
            </Text>
            <Text align="center" color={colors.textSecondary}>
              {step === 'form' ? s.hint : step === 'code' ? s.codeSent(email.trim()) : s.done}
            </Text>
          </Animated.View>

          {step === 'done' ? (
            <Button label={t.common.continue} onPress={() => router.back()} />
          ) : (
            <Animated.View entering={enter.up(100)}>
              <Card padding={spacing.xl}>
                {step === 'form' ? (
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
                    />
                    <TextField
                      icon={KeyRound}
                      placeholder={t.signIn.password}
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry
                      autoComplete="new-password"
                      textContentType="newPassword"
                      onSubmitEditing={() => canSubmit && submit()}
                    />
                    {error ? <Text color={colors.danger}>{error}</Text> : null}
                    <Button
                      label={s.submit}
                      onPress={submit}
                      loading={loading}
                      disabled={!canSubmit}
                    />
                  </View>
                ) : (
                  <View style={styles.form}>
                    <TextField
                      icon={Hash}
                      placeholder={s.code}
                      value={code}
                      onChangeText={setCode}
                      keyboardType="number-pad"
                      autoComplete="one-time-code"
                      textContentType="oneTimeCode"
                      maxLength={10}
                      onSubmitEditing={() => canConfirm && confirm()}
                    />
                    {error ? <Text color={colors.danger}>{error}</Text> : null}
                    <Button
                      label={s.confirm}
                      onPress={confirm}
                      loading={loading}
                      disabled={!canConfirm}
                    />
                    <Button
                      variant="ghost"
                      haptic="tap"
                      label={s.resend}
                      sentence
                      disabled={loading}
                      onPress={resend}
                    />
                  </View>
                )}
              </Card>
            </Animated.View>
          )}

          {step !== 'done' ? (
            <Button
              variant="ghost"
              haptic="tap"
              label={t.common.back}
              sentence
              onPress={() => router.back()}
            />
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    content: { flexGrow: 1, justifyContent: 'center', padding: spacing.xl, gap: spacing.xl },
    hero: { alignItems: 'center', gap: spacing.sm },
    form: { gap: spacing.lg },
  }),
);
