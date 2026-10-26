import React from 'react';
import { Image, Pressable, StatusBar } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Home, Users, Settings2, Landmark, Sliders, User, Sun, Moon } from '@tamagui/lucide-icons';
import { XStack } from 'tamagui';
import { useThemeContext } from '../../context/ThemeContext';
import { SyncStatusBadge } from '../../components/SyncStatusBadge';
import { useAccess } from '../../lib/access';
import { fonts, radius } from '../../theme/tokens';
import { haptic } from '../../theme/haptics';

const TAB_BAR_HEIGHT = 56;

export default function TabLayout() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isDark, toggleTheme, colors } = useThemeContext();
  const { can } = useAccess();
  // Hub tabs are hidden when the user can't open any module inside them (href: null)
  const showPeople = can('members') || can('visitors') || can('children');
  const showOperations = can('attendance') || can('ministry') || can('zones');
  const showFinances = can('giving') || can('expenses');

  const headerIconButton = (pressed: boolean) => ({
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: pressed ? colors.borderStrong : colors.surfaceMuted,
  });

  return (
    <>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.surface} animated />
      <Tabs
        screenListeners={{ tabPress: () => { haptic.selection(); } }}
        screenOptions={{
          headerShown: true,
          headerTitleAlign: 'left',
          sceneStyle: { backgroundColor: colors.background },
          headerStyle: {
            backgroundColor: colors.surface,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
            elevation: 0,
            shadowOpacity: 0,
          },
          headerTitle: 'COCM Portal',
          headerTitleStyle: {
            fontFamily: fonts.heading,
            fontSize: 18,
            color: colors.text,
            letterSpacing: -0.3,
          },
          headerLeft: () => (
            <Image
              source={require('../../../assets/icon.png')}
              style={{ width: 32, height: 32, borderRadius: 9, marginLeft: 16 }}
              resizeMode="contain"
              accessibilityIgnoresInvertColors
            />
          ),
          headerRight: () => (
            <XStack gap={8} alignItems="center" marginRight={16}>
              <SyncStatusBadge />
              <Pressable
                onPress={() => { haptic.selection(); toggleTheme(); }}
                accessibilityRole="button"
                accessibilityLabel={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
                hitSlop={6}
                style={({ pressed }) => headerIconButton(pressed)}
              >
                {isDark ? <Sun size={18} color={colors.text} /> : <Moon size={18} color={colors.text} />}
              </Pressable>
              <Pressable
                onPress={() => { haptic.light(); router.push('/profile' as any); }}
                accessibilityRole="button"
                accessibilityLabel="Profile"
                hitSlop={6}
                style={({ pressed }) => headerIconButton(pressed)}
              >
                <User size={18} color={colors.text} />
              </Pressable>
            </XStack>
          ),
          tabBarActiveTintColor: colors.primary.text,
          tabBarInactiveTintColor: colors.textSubtle,
          tabBarLabelStyle: {
            fontFamily: fonts.bodySemiBold,
            fontSize: 11,
          },
          tabBarStyle: {
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
            borderTopWidth: 1,
            // Respect the home indicator instead of a fixed height
            height: TAB_BAR_HEIGHT + insets.bottom,
            paddingTop: 6,
            paddingBottom: Math.max(insets.bottom, 8),
            elevation: 0,
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
            tabBarIcon: ({ color, focused }) => <Home size={22} color={color as string} strokeWidth={focused ? 2.4 : 2} />,
          }}
        />
        <Tabs.Screen
          name="people"
          options={{
            title: 'People',
            href: showPeople ? undefined : null,
            tabBarIcon: ({ color, focused }) => <Users size={22} color={color as string} strokeWidth={focused ? 2.4 : 2} />,
          }}
        />
        <Tabs.Screen
          name="operations"
          options={{
            title: 'Operations',
            href: showOperations ? undefined : null,
            tabBarIcon: ({ color, focused }) => <Settings2 size={22} color={color as string} strokeWidth={focused ? 2.4 : 2} />,
          }}
        />
        <Tabs.Screen
          name="finances"
          options={{
            title: 'Finances',
            href: showFinances ? undefined : null,
            tabBarIcon: ({ color, focused }) => <Landmark size={22} color={color as string} strokeWidth={focused ? 2.4 : 2} />,
          }}
        />
        <Tabs.Screen
          name="system"
          options={{
            title: 'System',
            tabBarIcon: ({ color, focused }) => <Sliders size={22} color={color as string} strokeWidth={focused ? 2.4 : 2} />,
          }}
        />
      </Tabs>
    </>
  );
}
