import { Tabs } from 'expo-router';
import { CircleUserRound, LibraryBig, Map as MapIcon } from 'lucide-react-native';

import { Icon, colors, fonts, haptics } from '@/theme';

export default function TabsLayout() {
  return (
    <Tabs
      screenListeners={{ tabPress: () => haptics.select() }}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.background },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontFamily: fonts.extraBold, fontSize: 12 },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopWidth: 2,
          borderTopColor: colors.border,
          height: 72,
          paddingTop: 6,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Histoires',
          tabBarIcon: ({ color }) => <Icon icon={MapIcon} size={26} color={color} />,
        }}
      />
      <Tabs.Screen
        name="vocabulary"
        options={{
          title: 'Mes mots',
          tabBarIcon: ({ color }) => <Icon icon={LibraryBig} size={26} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
          tabBarIcon: ({ color }) => <Icon icon={CircleUserRound} size={26} color={color} />,
        }}
      />
    </Tabs>
  );
}
