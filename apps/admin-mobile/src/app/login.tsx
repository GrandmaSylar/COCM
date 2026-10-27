import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { Lock, Mail, ShieldCheck } from 'lucide-react-native';
import { AppText, Button, IconWell, Screen, TextField } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useAppColors } from '../context/ThemeContext';
import { isConfigured } from '../lib/supabase';

export default function LoginScreen() {
  const c = useAppColors();
  const { signIn, notice } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    const message = await signIn(email, password);
    if (message) setError(message);
    setBusy(false);
  }

  return (
    <Screen edges={['top', 'bottom', 'left', 'right']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 20, gap: 20 }} keyboardShouldPersistTaps="handled">
          <View style={{ gap: 12 }}>
            <IconWell icon={ShieldCheck} size={56} />
            <View style={{ gap: 4 }}>
              <AppText variant="display">CoC.M Admin</AppText>
              <AppText variant="body" tone="muted">
                Sign in with your CoC.M account. Only developer accounts can use this app.
              </AppText>
            </View>
          </View>

          {!isConfigured ? (
            <View style={{ backgroundColor: c.danger.soft, borderRadius: 12, padding: 12 }}>
              <AppText variant="caption" tone="danger">
                Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY. Copy .env.example to .env and fill them in.
              </AppText>
            </View>
          ) : null}
          {notice ? (
            <View style={{ backgroundColor: c.warning.soft, borderRadius: 12, padding: 12 }}>
              <AppText variant="caption" tone="warning">
                {notice}
              </AppText>
            </View>
          ) : null}

          <View style={{ gap: 16 }}>
            <TextField label="Email" icon={Mail} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" textContentType="username" />
            <TextField label="Password" icon={Lock} value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoComplete="current-password" textContentType="password" error={error} onSubmitEditing={() => void submit()} returnKeyType="go" />
          </View>

          <Button label="Sign in" loading={busy} disabled={!email.trim() || !password} onPress={() => void submit()} fullWidth />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
