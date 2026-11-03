import { Tabs } from 'expo-router';
import { CircleUserRound, LibraryBig, Map as MapIcon } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useI18n } from '@/i18n';
import { colors, enter, fonts, haptics, Icon, themed } from '@/theme';

/** Frame given to the loader before the new tab is drawn (as when turning a page). */
const SWITCH_DELAY_MS = 40;
/** The loader shows only when switching lasts longer than this. */
const LOADER_DELAY_MS = 200;
/** Never left on screen, should the new tab fail to report its focus. */
const SWITCH_TIMEOUT_MS = 3000;

export default function TabsLayout() {
  const { t } = useI18n();
  // The bar pads itself by the system navigation bar, so that height has to be added on top
  // (Android with 3-button navigation: ~48px, which a fixed height would eat into).
  const insets = useSafeAreaInsets();
  const tabBarHeight = 72 + insets.bottom;
  // Switching tab: the new screen is being drawn (a loader covers the scene meanwhile).
  const [switching, setSwitching] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  return (
    <View style={styles.flex}>
      <Tabs
        screenListeners={({ navigation, route }) => ({
          tabPress: (e) => {
            haptics.select();
            if (navigation.isFocused()) return;
            // Drawing a tab keeps a slow phone busy for a moment: give the loader a frame to
            // be handed to the screen first (its fade-in then runs natively).
            e.preventDefault();
            setSwitching(true);
            timers.current.forEach(clearTimeout);
            timers.current = [
              setTimeout(() => navigation.navigate(route.name), SWITCH_DELAY_MS),
              setTimeout(() => setSwitching(false), SWITCH_TIMEOUT_MS),
            ];
          },
          // The new tab is on screen: take the loader away once it has been painted.
          focus: () => requestAnimationFrame(() => setSwitching(false)),
        })}
        screenOptions={{
          headerShown: false,
          sceneStyle: { backgroundColor: colors.background },
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarLabelStyle: { fontFamily: fonts.extraBold, fontSize: 12 },
          tabBarBackground: () => <View style={styles.tabBar} />,
          tabBarStyle: {
            backgroundColor: colors.surface,
            borderTopWidth: 2,
            borderTopColor: colors.border,
            height: tabBarHeight,
            paddingTop: 6,
          },
        }}>
        <Tabs.Screen
          name="index"
          options={{
            title: t.tabs.stories,
            tabBarIcon: ({ color }) => <Icon icon={MapIcon} size={26} color={color} />,
          }}
        />
        <Tabs.Screen
          name="vocabulary"
          options={{
            title: t.tabs.vocabulary,
            tabBarIcon: ({ color }) => <Icon icon={LibraryBig} size={26} color={color} />,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: t.tabs.profile,
            tabBarIcon: ({ color }) => <Icon icon={CircleUserRound} size={26} color={color} />,
          }}
        />
      </Tabs>
      {switching ? (
        <Animated.View
          entering={enter.fade(LOADER_DELAY_MS)}
          style={[styles.switching, { bottom: tabBarHeight }]}>
          <ActivityIndicator size="large" color={colors.primary} />
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    flex: { flex: 1 },
    tabBar: { ...StyleSheet.absoluteFill, backgroundColor: colors.surface },
    // Over the scene only: the tab bar stays visible and shows the tab being opened.
    switching: {
      position: 'absolute',
      top: 0,
      right: 0,
      left: 0,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.background,
    },
  }),
);
