import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { BookOpen } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { GoalToast } from '@/components/GoalToast';
import { LaunchScreen } from '@/components/LaunchScreen';
import { I18nProvider, useI18n } from '@/i18n';
import { AuthProvider, useAuth } from '@/lib/auth';
import { StatsProvider, useStats } from '@/lib/stats';
import { TourProvider } from '@/lib/tour';
import { Loader, colors, fontAssets } from '@/theme';

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
  // Cold start: the launch screen covers the app until it is ready, then fades out.
  const [launching, setLaunching] = useState(true);
  const endLaunch = useCallback(() => setLaunching(false), []);

  useEffect(() => {
    // The launch screen hides the native splash itself; this is a fallback.
    if (!loading) SplashScreen.hide();
  }, [loading]);

  const launch = launching ? (
    <LaunchScreen done={!loading} fontsReady={fontsLoaded} onHidden={endLaunch} />
  ) : null;
  if (loading && launching) return launch;
  // Loading again after the launch: just after signing in.
  if (loading) {
    return (
      <View style={styles.loading}>
        {/* No message: the fonts may not be loaded yet. */}
        <Loader icon={BookOpen} />
      </View>
    );
  }

  const signedIn = !!session;
  // First sign-in: choose the language, then the daily goal (null = not chosen yet).
  const needsLang = signedIn && stats?.lang === null;
  const needsGoal = signedIn && !needsLang && stats?.daily_goal_minutes === null;
  // Accounts created before usernames choose one (new accounts pick it at sign-up).
  const needsUsername = signedIn && !needsLang && !needsGoal && stats?.username === null;
  const onboarding = needsLang || needsGoal || needsUsername;
  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}>
        {/* Guards switch screens automatically when the session changes. */}
        <Stack.Protected guard={signedIn && !onboarding}>
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
        <Stack.Protected guard={needsUsername}>
          <Stack.Screen name="username" options={{ animation: 'fade' }} />
        </Stack.Protected>
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="sign-in" />
          <Stack.Screen name="forgot-password" />
        </Stack.Protected>
      </Stack>
      {/* Above every screen: today's goal can be reached while reading or reviewing. */}
      {signedIn ? <GoalToast /> : null}
      {launch}
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
