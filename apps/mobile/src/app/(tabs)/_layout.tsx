import React from 'react';
import { Image, TouchableOpacity } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { Home, Users, Settings2, Landmark, Sliders, User } from '@tamagui/lucide-icons';
import { XStack } from 'tamagui';

export default function TabLayout() {
  const router = useRouter();

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerStyle: {
          backgroundColor: '#FFFFFF',
          elevation: 2,
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.1,
          shadowRadius: 2,
        },
        headerTitle: 'COCM Portal',
        headerTitleStyle: {
          fontWeight: '800',
          fontSize: 16,
          color: '#1C1C1E',
        },
        headerLeft: () => (
          <Image
            source={require('../../../assets/icon.png')}
            style={{ width: 34, height: 34, borderRadius: 8, marginLeft: 16 }}
            resizeMode="contain"
          />
        ),
        headerRight: () => (
          <TouchableOpacity 
            style={{ marginRight: 16, padding: 4 }}
            onPress={() => router.push('/profile' as any)}
          >
            <User size={22} color="#007AFF" />
          </TouchableOpacity>
        ),
        tabBarActiveTintColor: '#007AFF',
        tabBarInactiveTintColor: '#8E8E93',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: '#E5E5EA',
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <Home size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="people"
        options={{
          title: 'People',
          tabBarIcon: ({ color }) => <Users size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="operations"
        options={{
          title: 'Operations',
          tabBarIcon: ({ color }) => <Settings2 size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="finances"
        options={{
          title: 'Finances',
          tabBarIcon: ({ color }) => <Landmark size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="system"
        options={{
          title: 'System',
          tabBarIcon: ({ color }) => <Sliders size={22} color={color} />,
        }}
      />
    </Tabs>
  );
}
