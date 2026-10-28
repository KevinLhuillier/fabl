import { Tabs } from 'expo-router';
import { CircleUserRound, LibraryBig, Map as MapIcon } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useI18n } from '@/i18n';
import { useTourTarget } from '@/lib/tour';
import { Icon, colors, fonts, haptics } from '@/theme';

export default function TabsLayout() {
  const { t } = useI18n();
  // The home tour points at the tab bar ("Mes mots", "Profil").
  const target = useTourTarget('home');
  // The bar pads itself by the system navigation bar, so that height has to be added on top
  // (Android with 3-button navigation: ~48px, which a fixed height would eat into).
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenListeners={{ tabPress: () => haptics.select() }}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.background },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontFamily: fonts.extraBold, fontSize: 12 },
        tabBarBackground: () => (
          <View ref={target('tabs')} collapsable={false} style={styles.tabBar} />
        ),
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopWidth: 2,
          borderTopColor: colors.border,
          height: 72 + insets.bottom,
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
  );
}

const styles = StyleSheet.create({
  tabBar: { ...StyleSheet.absoluteFill, backgroundColor: colors.surface },
});
