import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { GoalToast } from '@/components/GoalToast';
import { I18nProvider, useI18n } from '@/i18n';
import { AuthProvider, useAuth } from '@/lib/auth';
import { StatsProvider, useStats } from '@/lib/stats';
import { TourProvider } from '@/lib/tour';
import { colors, fontAssets } from '@/theme';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <StatsProvider>
          <I18nProvider>
            <TourProvider>
              <RootNavigator />
            </TourProvider>
          </I18nProvider>
        </StatsProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}

function RootNavigator() {
  const [fontsLoaded, fontError] = useFonts(fontAssets);
  const { session, ready } = useAuth();
  const { ready: langReady } = useI18n();
  // Waiting for the stats tells whether the account has chosen its language yet.
  const { stats, ready: statsReady } = useStats();
  const loading = (!fontsLoaded && !fontError) || !ready || !langReady || !statsReady;

  useEffect(() => {
    if (!loading) SplashScreen.hideAsync();
  }, [loading]);

  // Under the splash screen at launch; visible just after signing in.
  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const signedIn = !!session;
  // First sign-in: choose the language, then the daily goal (null = not chosen yet).
  const needsLang = signedIn && stats?.lang === null;
  const needsGoal = signedIn && !needsLang && stats?.daily_goal_minutes === null;
  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}>
        {/* Guards switch screens automatically when the session changes. */}
        <Stack.Protected guard={signedIn && !needsLang && !needsGoal}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="story/[id]" />
          <Stack.Screen name="read/[chapterId]" options={{ gestureEnabled: false }} />
          <Stack.Screen
            name="review"
            options={{ presentation: 'fullScreenModal', gestureEnabled: false }}
          />
          <Stack.Screen name="celebration" options={{ animation: 'fade', gestureEnabled: false }} />
        </Stack.Protected>
        <Stack.Protected guard={needsLang}>
          <Stack.Screen name="language" options={{ animation: 'fade' }} />
        </Stack.Protected>
        <Stack.Protected guard={needsGoal}>
          <Stack.Screen name="daily-goal" options={{ animation: 'fade' }} />
        </Stack.Protected>
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="sign-in" />
        </Stack.Protected>
      </Stack>
      {/* Above every screen: today's goal can be reached while reading or reviewing. */}
      {signedIn ? <GoalToast /> : null}
    </>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
});
