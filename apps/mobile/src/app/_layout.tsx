import { useEffect } from 'react';
import { SplashScreen, Stack } from 'expo-router';
import { TamaguiProvider, Theme } from 'tamagui';
import { useFonts } from 'expo-font';
import tamaguiConfig from '../../tamagui.config';
import '../lib/uuid';
import { getLocalDb } from '../lib/db';
import { initRealtimeSettingsSync } from '../lib/options';
import { syncAllMetadata, flushSyncQueue } from '../lib/syncEngine';
import { ThemeProvider, useThemeContext } from '../context/ThemeContext';

// Keep the splash screen visible while loading resources
SplashScreen.preventAutoHideAsync();

function AppContent() {
  const { themeMode } = useThemeContext();

  return (
    <TamaguiProvider config={tamaguiConfig} defaultTheme={themeMode}>
      <Theme name={themeMode}>
        <Stack
          screenOptions={{
            headerShown: false,
            animation: 'slide_from_right',
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="onboarding" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="profile" />
        </Stack>
      </Theme>
    </TamaguiProvider>
  );
}

export default function RootLayout() {
  const [loaded] = useFonts({
    Inter: require('@tamagui/font-inter/otf/Inter-Medium.otf'),
    InterBold: require('@tamagui/font-inter/otf/Inter-Bold.otf'),
  });

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  // Initialize SQLite database and sync services on startup
  useEffect(() => {
    async function initMobileBackend() {
      try {
        await getLocalDb();
        await syncAllMetadata();
        await flushSyncQueue();
      } catch (err) {
        console.warn('Error during startup database & metadata sync:', err);
      }
    }

    initMobileBackend();
    const unsubscribeRealtime = initRealtimeSettingsSync();

    return () => {
      unsubscribeRealtime();
    };
  }, []);

  if (!loaded) {
    return null;
  }

  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}

