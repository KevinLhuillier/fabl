import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { I18nProvider, useI18n } from '@/i18n';
import { AuthProvider, useAuth } from '@/lib/auth';
import { StatsProvider } from '@/lib/stats';
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
  const loading = (!fontsLoaded && !fontError) || !ready || !langReady;

  useEffect(() => {
    if (!loading) SplashScreen.hideAsync();
  }, [loading]);

  if (loading) return null;

  const signedIn = !!session;
  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}>
        {/* Guards switch screens automatically when the session changes. */}
        <Stack.Protected guard={signedIn}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="story/[id]" />
          <Stack.Screen name="read/[chapterId]" options={{ gestureEnabled: false }} />
          <Stack.Screen
            name="review"
            options={{ presentation: 'fullScreenModal', gestureEnabled: false }}
          />
          <Stack.Screen name="celebration" options={{ animation: 'fade', gestureEnabled: false }} />
        </Stack.Protected>
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="sign-in" />
        </Stack.Protected>
      </Stack>
    </>
  );
}
