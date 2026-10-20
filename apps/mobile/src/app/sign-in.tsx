import { BookOpen, KeyRound, Mail } from 'lucide-react-native';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useI18n } from '@/i18n';
import { authErrorMessage } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
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

type Mode = 'signIn' | 'signUp';

export default function SignIn() {
  const { t } = useI18n();
  const [mode, setMode] = useState<Mode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function submit() {
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      const credentials = { email: email.trim(), password };
      if (mode === 'signIn') {
        const { error } = await supabase.auth.signInWithPassword(credentials);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp(credentials);
        if (error) throw error;
        // With "Confirm email" enabled, Supabase returns no session yet.
        if (!data.session) {
          setInfo(t.signIn.accountCreated);
          setMode('signIn');
        }
      }
      // On success the auth guard in _layout switches to the app automatically.
    } catch (e) {
      haptics.error();
      setError(authErrorMessage(t, e instanceof Error ? e.message : String(e)));
    } finally {
      setLoading(false);
    }
  }

  const canSubmit = email.includes('@') && password.length >= 6;

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.safe}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Animated.View entering={enter.up()} style={styles.hero}>
            <IconBubble icon={BookOpen} />
            <Text variant="display" color={colors.primary}>
              Fabl
            </Text>
            <Text align="center" color={colors.textSecondary}>
              {t.signIn.tagline}
            </Text>
          </Animated.View>

          <Animated.View entering={enter.up(100)}>
            <Card padding={spacing.xl}>
              <View style={styles.form}>
                <Text variant="heading">
                  {mode === 'signIn' ? t.signIn.welcomeBack : t.signIn.createAccount}
                </Text>
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
                  autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'}
                  textContentType={mode === 'signIn' ? 'password' : 'newPassword'}
                  onSubmitEditing={() => canSubmit && submit()}
                />
                {error ? <Text color={colors.danger}>{error}</Text> : null}
                {info ? <Text color={colors.successShade}>{info}</Text> : null}
                <Button
                  label={mode === 'signIn' ? t.signIn.signIn : t.signIn.signUp}
                  onPress={submit}
                  loading={loading}
                  disabled={!canSubmit}
                />
              </View>
            </Card>
          </Animated.View>

          <Button
            variant="ghost"
            haptic="tap"
            label={mode === 'signIn' ? t.signIn.noAccount : t.signIn.haveAccount}
            sentence
            onPress={() => {
              setMode(mode === 'signIn' ? 'signUp' : 'signIn');
              setError(null);
            }}
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
