import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Alert, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { 
  YStack, 
  XStack, 
  Text, 
  Input, 
  Button, 
  H1, 
  Paragraph, 
  Card, 
  Spinner 
} from 'tamagui';
import * as SecureStore from 'expo-secure-store';
import { supabase } from '../lib/supabase';
import { api } from '../lib/api';

export default function LoginScreen() {
  const router = useRouter();
  const [checkingSession, setCheckingSession] = useState(true);
  const [loading, setLoading] = useState(false);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');

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
      Alert.alert('Missing Fields', 'Please fill in both your email/phone and password.');
      return;
    }

    setLoading(true);
    try {
      const response = await api.auth.signIn(identifier, password);
      
      // Store session manually inside Supabase Client
      if (response && response.session) {
        const { error } = await supabase.auth.setSession({
          access_token: response.session.access_token,
          refresh_token: response.session.refresh_token,
        });

        if (error) throw error;
        router.replace('/(tabs)' as any);
      } else {
        throw new Error('Invalid response signature from backend server');
      }
    } catch (error: any) {
      console.error('Failed to log in:', error);
      Alert.alert('Authentication Failed', error.message || 'Please check your connection and credentials.');
    } finally {
      setLoading(false);
    }
  };

  if (checkingSession) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center" backgroundColor="$background">
        <Spinner size="large" color="$primary" />
      </YStack>
    );
  }

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
    >
      <YStack flex={1} backgroundColor="$background" justifyContent="center" paddingHorizontal="$6">
        <YStack space="$5" alignItems="center">
          {/* Logo */}
          <Image 
            source={require('../../assets/icon.png')}
            style={{ width: 88, height: 88, borderRadius: 22, marginBottom: 8 }}
            resizeMode="contain"
          />

          {/* Header */}
          <YStack space="$1" alignItems="center" marginBottom="$3">
            <H1 color="$color" fontWeight="800" fontSize={30} letterSpacing={-1}>
              Welcome Back
            </H1>
            <Paragraph color="$colorPress" fontSize={14} textAlign="center">
              Church Management System Portal
            </Paragraph>
          </YStack>

          {/* Card Form Wrapper */}
          <Card 
            width="100%"
            padding="$5" 
            borderRadius="$5" 
            backgroundColor="$cardBackground" 
            borderColor="$borderColor" 
            borderWidth={1}
            elevate
            shadowColor="$shadowColor"
            shadowRadius={15}
          >
            <YStack space="$4">
              {/* Username/Email Input */}
              <YStack space="$1.5">
                <Text color="$color" fontSize={14} fontWeight="600">Email or Phone Number</Text>
                <Input 
                  value={identifier}
                  onChangeText={setIdentifier}
                  placeholder="Enter email or phone"
                  autoCapitalize="none"
                  keyboardType="email-address"
                  height={44}
                  borderRadius="$3"
                  backgroundColor="$background"
                  borderColor="$borderColor"
                  focusStyle={{ borderColor: '$primary', borderWidth: 1.5 }}
                />
              </YStack>

              {/* Password Input */}
              <YStack space="$1.5">
                <Text color="$color" fontSize={14} fontWeight="600">Password</Text>
                <Input 
                  secureTextEntry
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Enter your password"
                  autoCapitalize="none"
                  height={44}
                  borderRadius="$3"
                  backgroundColor="$background"
                  borderColor="$borderColor"
                  focusStyle={{ borderColor: '$primary', borderWidth: 1.5 }}
                />
              </YStack>

              {/* Login Action */}
              <Button 
                themeInverse
                backgroundColor="$primary"
                height={48}
                borderRadius="$3"
                marginTop="$2"
                onPress={handleLogin}
                disabled={loading}
                pressStyle={{ scale: 0.98 }}
              >
                {loading ? <Spinner size="small" color="#FFFFFF" /> : <Text color="#FFFFFF" fontWeight="700" fontSize={16}>Sign In</Text>}
              </Button>
            </YStack>
          </Card>
        </YStack>
      </YStack>
    </KeyboardAvoidingView>
  );
}
