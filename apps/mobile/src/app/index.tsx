import React, { useEffect, useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import Animated from 'react-native-reanimated';
import { Mail, Phone, ShieldCheck, ArrowLeft, RefreshCw, Lock, User, AlertCircle } from '@tamagui/lucide-icons';
import * as SecureStore from 'expo-secure-store';
import { supabase } from '../lib/supabase';
import { api } from '../lib/api';
import { refreshAccessProfile } from '../lib/access';
import { useThemeContext } from '../context/ThemeContext';
import { syncEverything } from '../lib/syncEngine';
import { AppText, Button, OtpInput, Screen, TextField, useToast } from '../components/ui';
import { enterUp, fadeIn } from '../theme/animations';
import { haptic } from '../theme/haptics';
import { radius, space } from '../theme/tokens';

interface TwoFAState {
  userId: string;
  tempToken: string;
  availableMethods: string[];
  chosenMethod: 'email' | 'phone' | null;
  destination: string;
  step: 'choose' | 'otp';
}

export default function LoginScreen() {
  const router = useRouter();
  const { refreshFromServer: refreshThemeFromServer, colors: c } = useThemeContext();
  const toast = useToast();
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ identifier?: string; password?: string }>({});
  const [otpError, setOtpError] = useState<string | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [loading, setLoading] = useState(false);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');

  // 2FA State
  const [twoFaState, setTwoFaState] = useState<TwoFAState | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<'email' | 'phone'>('email');
  const [sendingCode, setSendingCode] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [resendingOtp, setResendingOtp] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(300);

  // Timers for 2FA OTP expiry and resend cooldown
  useEffect(() => {
    if (!twoFaState || twoFaState.step !== 'otp') return;

    const interval = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
      setTimeRemaining((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(interval);
  }, [twoFaState?.step]);

  useEffect(() => {
    const checkState = async () => {
      try {
        // 1. Check onboarding
        const hasOnboarded = await SecureStore.getItemAsync('has_onboarded');
        if (!hasOnboarded) {
          router.replace('/onboarding');
          return;
        }

        // 2. Check existing session
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          router.replace('/(tabs)' as any);
          return;
        }
      } catch (e) {
        console.error(e);
      } finally {
        setCheckingSession(false);
      }
    };
    checkState();
  }, []);

  const handleLogin = async () => {
    if (!identifier || !password) {
      setFieldErrors({
        identifier: identifier ? undefined : 'Enter your email or phone number.',
        password: password ? undefined : 'Enter your password.',
      });
      return;
    }

    setFieldErrors({});
    setFormError(null);
    setLoading(true);
    try {
      const response = await api.auth.signIn(identifier, password);

      // Handle 2FA required
      if (response && response.requires2FA) {
        const isDirectOtp = response.method && response.method !== 'choose';
        setTwoFaState({
          userId: response.userId,
          tempToken: response.tempToken,
          availableMethods: response.availableMethods || ['email', 'phone'],
          chosenMethod: isDirectOtp ? response.method : null,
          destination: response.destination || '',
          step: isDirectOtp ? 'otp' : 'choose',
        });

        if (isDirectOtp) {
          setResendCooldown(60);
          setTimeRemaining(300);
        }
        return;
      }
      
      // Store session manually inside Supabase Client
      if (response && response.session) {
        const { error } = await supabase.auth.setSession({
          access_token: response.session.access_token,
          refresh_token: response.session.refresh_token,
        });

        if (error) throw error;
        // Role/tab access must be known before the hubs render
        await refreshAccessProfile();
        // Startup sync is skipped while signed out, so run it now (in the background)
        syncEverything().catch(err => console.warn('Post-login sync failed:', err));
        // Apply this account's theme (shared with the web app)
        refreshThemeFromServer();
        router.replace('/(tabs)' as any);
      } else {
        throw new Error('Invalid response signature from backend server');
      }
    } catch (error: any) {
      console.error('Failed to log in:', error);
      setFormError(error.message || 'Sign-in failed. Check your connection and details, then try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async (methodToUse?: 'email' | 'phone') => {
    if (!twoFaState) return;
    const method = methodToUse || selectedMethod;
    setFormError(null);
    setSendingCode(true);
    try {
      const res = await api.auth.sendOtp({
        userId: twoFaState.userId,
        tempToken: twoFaState.tempToken,
        method,
      });

      setTwoFaState({
        ...twoFaState,
        chosenMethod: method,
        destination: res.destination || '',
        step: 'otp',
      });
      setResendCooldown(60);
      setTimeRemaining(300);
      setOtpCode('');
    } catch (err: any) {
      setFormError(err?.message || 'We couldn’t send the code. Try again.');
    } finally {
      setSendingCode(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!twoFaState) return;
    if (otpCode.trim().length !== 6) {
      setOtpError('Enter all 6 digits.');
      return;
    }

    setOtpError(null);
    setFormError(null);
    setVerifyingOtp(true);
    try {
      const res = await api.auth.verifyOtp({
        userId: twoFaState.userId,
        tempToken: twoFaState.tempToken,
        code: otpCode.trim(),
      });

      if (res && res.session) {
        const { error } = await supabase.auth.setSession({
          access_token: res.session.access_token,
          refresh_token: res.session.refresh_token,
        });

        if (error) throw error;
        await refreshAccessProfile();
        syncEverything().catch(err => console.warn('Post-login sync failed:', err));
        // Apply this account's theme (shared with the web app)
        refreshThemeFromServer();
        setTwoFaState(null);
        router.replace('/(tabs)' as any);
      } else {
        throw new Error('Invalid verification response from server.');
      }
    } catch (err: any) {
      setOtpError(err?.message || 'That code is wrong or has expired. Try again.');
    } finally {
      setVerifyingOtp(false);
    }
  };

  const handleResendOtp = async () => {
    if (!twoFaState || resendCooldown > 0) return;
    setResendingOtp(true);
    try {
      await api.auth.resendOtp({
        userId: twoFaState.userId,
        tempToken: twoFaState.tempToken,
      });
      setResendCooldown(60);
      setTimeRemaining(300);
      toast.show({ title: 'New code sent' });
    } catch (err: any) {
      toast.show({ title: 'Couldn’t resend the code', message: err?.message, tone: 'error' });
    } finally {
      setResendingOtp(false);
    }
  };

  const handleCancel2FA = () => {
    setTwoFaState(null);
    setOtpCode('');
    setFormError(null);
    setOtpError(null);
  };

  const formatTimer = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  if (checkingSession) {
    return (
      // Blank while the session check runs (milliseconds, under the splash);
      // a skeleton login form here flashed before signed-in users reached the app.
      <Screen edges={['top', 'bottom', 'left', 'right']}>{null}</Screen>
    );
  }

  const step = !twoFaState ? 'signin' : twoFaState.step;
  const titles = {
    signin: { title: 'Welcome back', subtitle: 'Sign in to the church management portal.' },
    choose: { title: 'Verify it’s you', subtitle: 'Choose where to send your 6-digit code.' },
    otp: {
      title: 'Enter your code',
      subtitle: `We sent a 6-digit code by ${twoFaState?.chosenMethod === 'email' ? 'email' : 'SMS'} to ${twoFaState?.destination || 'your contact'}.`,
    },
  }[step];

  const methodOption = (method: 'email' | 'phone', Icon: any, title: string, description: string) => {
    const selected = selectedMethod === method;
    return (
      <Pressable
        key={method}
        onPress={() => { haptic.selection(); setSelectedMethod(method); }}
        accessibilityRole="radio"
        accessibilityState={{ selected }}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.sm,
          padding: space.md,
          borderRadius: radius.lg,
          borderWidth: selected ? 2 : 1,
          borderColor: selected ? c.primary.base : c.border,
          backgroundColor: selected ? c.primary.soft : c.surface,
        }}
      >
        <Icon size={22} color={selected ? c.primary.text : c.textMuted} />
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="bodyStrong">{title}</AppText>
          <AppText variant="caption" tone="muted">{description}</AppText>
        </View>
        <View
          style={{
            width: 22, height: 22, borderRadius: 11, borderWidth: 2,
            borderColor: selected ? c.primary.base : c.borderStrong,
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          {selected ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: c.primary.base }} /> : null}
        </View>
      </Pressable>
    );
  };

  return (
    <Screen edges={['top', 'bottom', 'left', 'right']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: space.lg, gap: space.xl }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Brand */}
          <View style={{ alignItems: 'center', gap: space.md }}>
            <Image
              source={require('../../assets/icon.png')}
              style={{ width: 80, height: 80 }}
              resizeMode="contain"
              accessibilityLabel="Church of Christ Mataheko logo"
            />
            <Animated.View key={step} entering={fadeIn()} style={{ alignItems: 'center', gap: 6 }}>
              <AppText variant="display" align="center" accessibilityRole="header">{titles.title}</AppText>
              <AppText variant="body" tone="muted" align="center" style={{ maxWidth: 320 }}>{titles.subtitle}</AppText>
            </Animated.View>
          </View>

          {formError ? (
            <Animated.View entering={fadeIn()} style={{ flexDirection: 'row', gap: 10, padding: space.sm, borderRadius: radius.md, backgroundColor: c.danger.soft }}>
              <AlertCircle size={18} color={c.danger.text} />
              <AppText variant="caption" tone="danger" style={{ flex: 1 }} accessibilityLiveRegion="assertive">{formError}</AppText>
            </Animated.View>
          ) : null}

          <Animated.View key={`form-${step}`} entering={enterUp()} style={{ gap: space.md }}>
            {step === 'signin' ? (
              <>
                <TextField
                  label="Email or phone number"
                  icon={User}
                  value={identifier}
                  onChangeText={t => { setIdentifier(t); if (fieldErrors.identifier) setFieldErrors(e => ({ ...e, identifier: undefined })); }}
                  placeholder="you@example.com"
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  textContentType="username"
                  autoComplete="username"
                  returnKeyType="next"
                  error={fieldErrors.identifier}
                />
                <TextField
                  label="Password"
                  icon={Lock}
                  value={password}
                  onChangeText={t => { setPassword(t); if (fieldErrors.password) setFieldErrors(e => ({ ...e, password: undefined })); }}
                  placeholder="Your password"
                  secureTextEntry
                  autoCapitalize="none"
                  textContentType="password"
                  autoComplete="password"
                  returnKeyType="go"
                  onSubmitEditing={handleLogin}
                  error={fieldErrors.password}
                />
                <View style={{ marginTop: space.xs }}>
                  <Button label={loading ? 'Signing in…' : 'Sign in'} loading={loading} fullWidth onPress={handleLogin} />
                </View>
              </>
            ) : null}

            {step === 'choose' && twoFaState ? (
              <>
                <View style={{ gap: space.xs }}>
                  {twoFaState.availableMethods.includes('email') ? methodOption('email', Mail, 'Email', 'Send the code to your registered email') : null}
                  {twoFaState.availableMethods.includes('phone') ? methodOption('phone', Phone, 'Text message', 'Send the code by SMS to your phone') : null}
                </View>
                <Button label="Send code" icon={ShieldCheck} loading={sendingCode} fullWidth onPress={() => handleSendOtp()} />
                <Button label="Back to sign in" icon={ArrowLeft} variant="ghost" fullWidth onPress={handleCancel2FA} />
              </>
            ) : null}

            {step === 'otp' && twoFaState ? (
              <>
                <OtpInput
                  value={otpCode}
                  onChange={code => { setOtpCode(code); if (otpError) setOtpError(null); }}
                  error={!!otpError}
                  autoFocus
                />
                {otpError ? <AppText variant="caption" tone="danger" align="center">{otpError}</AppText> : null}

                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm }}>
                  <AppText variant="caption" tone={timeRemaining <= 0 ? 'danger' : 'muted'} numeric>
                    {timeRemaining <= 0 ? 'Code expired' : `Expires in ${formatTimer(timeRemaining)}`}
                  </AppText>
                  <Button
                    label={resendingOtp ? 'Sending…' : resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend code'}
                    icon={RefreshCw}
                    variant="ghost"
                    size="sm"
                    disabled={resendCooldown > 0 || resendingOtp}
                    onPress={handleResendOtp}
                  />
                </View>

                <Button
                  label="Verify and sign in"
                  loading={verifyingOtp}
                  disabled={otpCode.trim().length !== 6 || timeRemaining <= 0}
                  fullWidth
                  onPress={handleVerifyOtp}
                />
                <Button
                  label={twoFaState.availableMethods.length > 1 ? 'Use a different method' : 'Back to sign in'}
                  icon={ArrowLeft}
                  variant="ghost"
                  fullWidth
                  onPress={() => {
                    setOtpError(null);
                    if (twoFaState.availableMethods.length > 1) {
                      setTwoFaState({ ...twoFaState, step: 'choose' });
                    } else {
                      handleCancel2FA();
                    }
                  }}
                />
              </>
            ) : null}
          </Animated.View>

          <AppText variant="caption" tone="subtle" align="center">Church of Christ · Mataheko</AppText>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
