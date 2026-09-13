import React from 'react';
import { Image, TouchableOpacity } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { Home, Users, Settings2, Landmark, Sliders, User, Sun, Moon } from '@tamagui/lucide-icons';
import { XStack } from 'tamagui';
import { useThemeContext } from '../../context/ThemeContext';
import { SyncStatusBadge } from '../../components/SyncStatusBadge';

import { StatusBar } from 'react-native';

export default function TabLayout() {
  const router = useRouter();
  const { isDark, toggleTheme, themeColors } = useThemeContext();

  return (
    <>
      <StatusBar barStyle={themeColors.statusBarStyle} backgroundColor={themeColors.headerBackground} animated />
      <Tabs
        screenOptions={{
          headerShown: true,
          headerTitleAlign: 'left',
          sceneStyle: { backgroundColor: themeColors.background },
          headerStyle: {
            backgroundColor: themeColors.headerBackground,
            elevation: 1,
            shadowColor: '#000000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: isDark ? 0.3 : 0.05,
            shadowRadius: 3,
          },
        headerTitle: 'COCM Portal',
        headerTitleStyle: {
          fontWeight: '800',
          fontSize: 18,
          color: themeColors.text,
          letterSpacing: -0.4,
        },
        headerLeft: () => (
          <Image
            source={require('../../../assets/icon.png')}
            style={{ width: 34, height: 34, borderRadius: 8, marginLeft: 16 }}
            resizeMode="contain"
          />
        ),
        headerRight: () => (
          <XStack space="$2" alignItems="center" marginRight={16}>
            {/* Live Sync Status Badge */}
            <SyncStatusBadge />

            {/* Dedicated Dark Mode Toggle Button */}
            <TouchableOpacity
              style={{
                padding: 7,
                borderRadius: 20,
                backgroundColor: isDark ? 'rgba(255, 149, 0, 0.15)' : 'rgba(0, 122, 255, 0.08)',
              }}
              onPress={toggleTheme}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              {isDark ? <Sun size={20} color="#FF9500" /> : <Moon size={20} color="#007AFF" />}
            </TouchableOpacity>

            {/* Profile User Icon */}
            <TouchableOpacity 
              style={{ 
                padding: 6,
                borderRadius: 20,
                backgroundColor: 'rgba(0, 122, 255, 0.08)'
              }}
              onPress={() => router.push('/profile' as any)}
              activeOpacity={0.7}
            >
              <User size={20} color="#007AFF" />
            </TouchableOpacity>
          </XStack>
        ),
        tabBarActiveTintColor: '#007AFF',
        tabBarInactiveTintColor: themeColors.textMuted,
        tabBarLabelStyle: {
          fontWeight: '600',
          fontSize: 11,
          marginTop: -2,
        },
        tabBarStyle: {
          backgroundColor: themeColors.tabBarBackground,
          borderTopColor: themeColors.tabBarBorder,
          borderTopWidth: 1,
          height: 62,
          paddingBottom: 8,
          paddingTop: 6,
          elevation: 8,
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: isDark ? 0.3 : 0.04,
          shadowRadius: 6,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <Home size={22} color={color as string} />,
        }}
      />
      <Tabs.Screen
        name="people"
        options={{
          title: 'People',
          tabBarIcon: ({ color }) => <Users size={22} color={color as string} />,
        }}
      />
      <Tabs.Screen
        name="operations"
        options={{
          title: 'Operations',
          tabBarIcon: ({ color }) => <Settings2 size={22} color={color as string} />,
        }}
      />
      <Tabs.Screen
        name="finances"
        options={{
          title: 'Finances',
          tabBarIcon: ({ color }) => <Landmark size={22} color={color as string} />,
        }}
      />
      <Tabs.Screen
        name="system"
        options={{
          title: 'System',
          tabBarIcon: ({ color }) => <Sliders size={22} color={color as string} />,
        }}
      />
    </Tabs>
  </>
  );
}

