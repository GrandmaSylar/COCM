import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import Animated from 'react-native-reanimated';
import { LogOut, Mail, Palette, ShieldCheck } from '@tamagui/lucide-icons';
import { supabase } from '../lib/supabase';
import { api } from '../lib/api';
import { clearAccessProfile, useAccess } from '../lib/access';
import { AppHeader } from '../components/AppHeader';
import { SkeletonProfile } from '../components/Skeleton';
import { AppText, Avatar, Badge, ListRow, Screen, Section } from '../components/ui';
import { enterUp } from '../theme/animations';
import { space } from '../theme/tokens';

export default function ProfileScreen() {
  const router = useRouter();
  const { profile: access, canRoute } = useAccess();
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const [profile, setProfile] = useState<{ name: string; email: string; role: string } | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          setProfile({
            name: session.user.user_metadata?.name || 'Administrator',
            email: session.user.email || '',
            role: session.user.user_metadata?.role || 'Admin',
          });
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await api.auth.signOut();
      await supabase.auth.signOut();
      await clearAccessProfile();
      router.replace('/');
    } catch (e) {
      console.error(e);
    } finally {
      setSigningOut(false);
    }
  };

  const confirmSignOut = () => {
    Alert.alert('Sign out?', 'Changes waiting to sync stay on this device and upload after you sign in again.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: handleSignOut },
    ]);
  };

  // The server-side role (from access) is authoritative; metadata is only a fallback
  const name = access?.name || profile?.name || 'Administrator';
  const role = access?.role || profile?.role || 'Admin';

  return (
    <Screen>
      <AppHeader title="Profile" subtitle="Account and session" showBack />

      {loading ? (
        <SkeletonProfile />
      ) : (
        <ScrollView contentContainerStyle={{ padding: space.md, paddingBottom: space.xxl, gap: space.xl }}>
          <Animated.View entering={enterUp()} style={{ alignItems: 'center', gap: space.sm, paddingTop: space.md }}>
            <Avatar name={name} size={88} />
            <View style={{ alignItems: 'center', gap: 4 }}>
              <AppText variant="title" align="center">{name}</AppText>
              {profile?.email ? <AppText variant="body" tone="muted" align="center">{profile.email}</AppText> : null}
            </View>
            <Badge label={role} tone="primary" />
          </Animated.View>

          <Animated.View entering={enterUp(40)}>
            <Section title="Account">
              <ListRow icon={Mail} iconTone="neutral" title="Email" subtitle={profile?.email || 'Not set'} />
              <ListRow icon={ShieldCheck} iconTone="neutral" title="Role" subtitle={role} />
            </Section>
          </Animated.View>

          {canRoute('/settings') ? (
            <Animated.View entering={enterUp(80)}>
              <Section title="Preferences">
                <ListRow
                  icon={Palette}
                  title="Appearance"
                  subtitle="Theme mode and colors"
                  onPress={() => router.push('/settings?section=appearance' as any)}
                />
              </Section>
            </Animated.View>
          ) : null}

          <Animated.View entering={enterUp(120)}>
            <Section>
              <ListRow
                icon={LogOut}
                title={signingOut ? 'Signing out…' : 'Sign out'}
                destructive
                disabled={signingOut}
                onPress={confirmSignOut}
                chevron={false}
              />
            </Section>
          </Animated.View>
        </ScrollView>
      )}
    </Screen>
  );
}
