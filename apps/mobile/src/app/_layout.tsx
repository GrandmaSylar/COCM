import { useEffect, useState } from 'react';
import { Alert, View } from 'react-native';
import { SplashScreen, Stack, useRouter, useSegments } from 'expo-router';
import { TamaguiProvider, Theme } from 'tamagui';
import { useFonts } from 'expo-font';
// Per-weight entry points so only these 7 faces are bundled
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import { PlusJakartaSans_600SemiBold } from '@expo-google-fonts/plus-jakarta-sans/600SemiBold';
import { PlusJakartaSans_700Bold } from '@expo-google-fonts/plus-jakarta-sans/700Bold';
import { PlusJakartaSans_800ExtraBold } from '@expo-google-fonts/plus-jakarta-sans/800ExtraBold';
import tamaguiConfig from '../../tamagui.config';
import '../lib/uuid';
import { getLocalDb } from '../lib/db';
import { initRealtimeSettingsSync } from '../lib/options';
import { syncEverything } from '../lib/syncEngine';
import { supabase } from '../lib/supabase';
import { ThemeProvider, useThemeContext } from '../context/ThemeContext';
import { useAccess, refreshAccessProfile } from '../lib/access';
import { ToastProvider } from '../components/ui/Toast';
import { AnimatedSplash } from '../components/AnimatedSplash';

// Keep the splash screen visible while loading resources
SplashScreen.preventAutoHideAsync();

function AppContent() {
  const { themeMode, colors } = useThemeContext();
  const router = useRouter();
  const segments = useSegments();
  const { ready, profile, canRoute } = useAccess();

  // Route guard: deep links / back-stack entries into a module the user's role
  // or tab access doesn't allow are sent back to the dashboard.
  useEffect(() => {
    if (!ready || !profile) return;
    const top = segments[0];
    if (!top || top.startsWith('(')) return;
    if (!canRoute(`/${top}`)) {
      router.replace('/(tabs)' as any);
      Alert.alert('Access Restricted', "You don't have access to this section. Ask an administrator to grant it.");
    }
  }, [ready, profile, segments]);

  return (
    <TamaguiProvider config={tamaguiConfig} defaultTheme={themeMode}>
      <Theme name={themeMode}>
        <ToastProvider>
        <Stack
          screenOptions={{
            headerShown: false,
            animation: 'slide_from_right',
            // Avoids a white flash behind screen transitions in dark mode
            contentStyle: { backgroundColor: colors.background },
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="onboarding" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="profile" />
        </Stack>
        </ToastProvider>
      </Theme>
    </TamaguiProvider>
  );
}

export default function RootLayout() {
  // Font faces referenced by tamagui.config.ts and src/theme/tokens.ts
  const [loaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });

  // The native splash is hidden by AnimatedSplash once its matching first frame
  // is drawn; it stays up until the local database has finished migrating.
  const [dbReady, setDbReady] = useState(false);
  const [splashDone, setSplashDone] = useState(false);

  // Initialize SQLite database and sync services on startup
  useEffect(() => {
    async function initMobileBackend() {
      try {
        try {
          await getLocalDb();
        } finally {
          setDbReady(true);
        }
        // Signed-out launches sync after login instead (see app/index.tsx)
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          await refreshAccessProfile();
          await syncEverything();
        }
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
      <View style={{ flex: 1 }}>
        <AppContent />
        {!splashDone ? <AnimatedSplash ready={dbReady} onDone={() => setSplashDone(true)} /> : null}
      </View>
    </ThemeProvider>
  );
}

