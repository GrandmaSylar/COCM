import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// Same storage approach as the main mobile app: the Keychain / Keystore on phones.
const SecureStorage = {
  getItem: (key: string) => {
    if (Platform.OS === 'web') return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
    return SecureStore.getItemAsync(key);
  },
  setItem: (key: string, value: string) => {
    if (Platform.OS === 'web') {
      if (typeof localStorage !== 'undefined') localStorage.setItem(key, value);
      return;
    }
    return SecureStore.setItemAsync(key, value);
  },
  removeItem: (key: string) => {
    if (Platform.OS === 'web') {
      if (typeof localStorage !== 'undefined') localStorage.removeItem(key);
      return;
    }
    return SecureStore.deleteItemAsync(key);
  },
};

export const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
export const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
export const isConfigured = Boolean(supabaseUrl && supabaseAnonKey);

// Signing in uses Supabase Auth directly, not the app's /auth/signin route, which would
// overwrite active_device_id and sign the person out of the main app. The storage key keeps
// this app's session apart from the main app's.
export const supabase = createClient(supabaseUrl ?? 'https://placeholder-url.supabase.co', supabaseAnonKey ?? 'placeholder-anon-key', {
  auth: {
    storage: SecureStorage,
    storageKey: 'cocm-admin-auth',
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
