import { router } from 'expo-router';
import { AtSign, BookOpen, KeyRound, Mail } from 'lucide-react-native';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useI18n } from '@/i18n';
import { authErrorMessage } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { USERNAME_TAKEN, isUsernameAvailable, isValidUsername } from '@/lib/username';
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
  const [username, setUsername] = useState('');
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
        // Checked first for a clear message; the database still has the last word.
        if (!(await isUsernameAvailable(username))) throw new Error(USERNAME_TAKEN);
        const { data, error } = await supabase.auth.signUp({
          ...credentials,
          // Copied into user_stats.username by the sign-up trigger.
          options: { data: { username: username.trim() } },
        });
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

  const usernameOk = mode === 'signIn' || isValidUsername(username);
  const canSubmit = email.includes('@') && password.length >= 6 && usernameOk;

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
                {mode === 'signUp' ? (
                  <View style={styles.field}>
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
                    />
                    {username && !isValidUsername(username) ? (
                      <Text variant="caption" color={colors.textSecondary}>
                        {t.signIn.errors.invalidUsername}
                      </Text>
                    ) : null}
                  </View>
                ) : null}
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
                {mode === 'signIn' ? (
                  <Button
                    variant="ghost"
                    haptic="tap"
                    label={t.signIn.forgotPassword}
                    sentence
                    onPress={() =>
                      router.push({ pathname: '/forgot-password', params: { email: email.trim() } })
                    }
                  />
                ) : null}
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
              setInfo(null);
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
  field: { gap: spacing.xs },
});
